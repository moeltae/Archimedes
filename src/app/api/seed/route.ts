import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchRecentPapers } from "@/lib/biorxiv";
import { extractPaperClaims, generateStudy, decomposeStudy, checkHypothesisNovelty } from "@/lib/openai";
import { createNoveltyTask, pollUntilDone, parseNoveltyResult } from "@/lib/futurehouse";

const NOVELTY_THRESHOLD = 5;

// Background: poll FutureHouse and update study when done
async function reviewInBackground(studyId: string, trajectoryId: string, hypothesis: string) {
  try {
    let noveltyScore = 5;
    let isNovel = true;
    let explanation = "";

    if (trajectoryId) {
      const result = await pollUntilDone(trajectoryId);
      if (result && result.status === "success") {
        const parsed = parseNoveltyResult(result);
        noveltyScore = parsed.novelty_score;
        isNovel = parsed.is_novel;
        explanation = parsed.explanation;
      } else {
        const fallback = await checkHypothesisNovelty(hypothesis);
        if (fallback) {
          noveltyScore = fallback.novelty_score ?? 5;
          isNovel = fallback.is_novel ?? (noveltyScore >= NOVELTY_THRESHOLD);
          explanation = (fallback as Record<string, unknown>).similar_work as string || "";
        }
      }
    } else {
      const fallback = await checkHypothesisNovelty(hypothesis);
      if (fallback) {
        noveltyScore = fallback.novelty_score ?? 5;
        isNovel = fallback.is_novel ?? (noveltyScore >= NOVELTY_THRESHOLD);
        explanation = (fallback as Record<string, unknown>).similar_work as string || "";
      }
    }

    const newStatus = isNovel ? "proposed" : "rejected";
    const updateData: Record<string, unknown> = {
      status: newStatus,
      novelty_score: noveltyScore,
      review_explanation: explanation.slice(0, 5000),
    };
    if (newStatus === "rejected") {
      updateData.rejected_at = new Date().toISOString();
    }
    await supabase
      .from("experiments")
      .update(updateData)
      .eq("id", studyId);
  } catch (err) {
    console.error(`Background review failed for study ${studyId}:`, err);
    await supabase
      .from("experiments")
      .update({ status: "proposed", novelty_score: 5 })
      .eq("id", studyId);
  }
}

interface BiorxivPaper {
  doi: string;
  title: string;
  authors: string;
  abstract: string;
  date: string;
  category: string;
}

// Process a single paper: extract claims → generate study → insert → decompose
async function processPaper(biorxivPaper: BiorxivPaper) {
  const { claims, research_gap } = await extractPaperClaims(
    biorxivPaper.abstract,
    biorxivPaper.title
  );

  const study = await generateStudy({
    title: biorxivPaper.title,
    abstract: biorxivPaper.abstract,
    claims,
    research_gap,
    category: biorxivPaper.category,
  });

  const { data: paper } = await supabase
    .from("papers")
    .insert({
      title: biorxivPaper.title,
      abstract: biorxivPaper.abstract,
      claims,
      research_gap,
      source_url: `https://doi.org/${biorxivPaper.doi}`,
    })
    .select()
    .single();

  if (!paper) throw new Error("paper_insert_failed");

  // Create FutureHouse novelty task (non-blocking)
  const trajectoryId = await createNoveltyTask(study.hypothesis);

  const { data: studyData } = await supabase
    .from("experiments")
    .insert({
      paper_id: paper.id,
      title: study.title,
      hypothesis: study.hypothesis,
      study_design: study.study_design,
      funding_goal: study.funding_goal,
      tags: study.tags || [],
      funded_amount: 0,
      upvotes: 0,
      downvotes: 0,
      status: "pending_review",
      review_task_id: trajectoryId,
    })
    .select()
    .single();

  if (!studyData) throw new Error("study_insert_failed");

  // Decompose into experiments
  const experiments = await decomposeStudy(study);
  const experimentInserts = experiments.map(
    (e: { module_name: string; description: string; expertise_required: string }) => ({
      experiment_id: studyData.id,
      module_name: e.module_name,
      description: e.description,
      expertise_required: e.expertise_required,
      status: "open",
      assigned_lab: null,
    })
  );
  await supabase.from("modules").insert(experimentInserts);

  return { studyData, trajectoryId, hypothesis: study.hypothesis };
}

// POST /api/seed
export async function POST(req: NextRequest) {
  const { secret, count = 5, days = 14, clear = false } = await req.json();

  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (clear) {
    await supabase.from("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("modules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("experiments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("papers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const papers = await fetchRecentPapers(days, count);

  // Process all papers in parallel — studies appear in the feed all at once
  const settled = await Promise.allSettled(
    papers.map((p) => processPaper(p))
  );

  const results: { paper: string; study: string; status: string }[] = [];
  const backgroundReviews: Promise<void>[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const paperTitle = papers[i].title;

    if (outcome.status === "fulfilled") {
      const { studyData, trajectoryId, hypothesis } = outcome.value;
      results.push({ paper: paperTitle, study: studyData.title, status: "pending_review" });

      // Fire off background review
      backgroundReviews.push(
        reviewInBackground(studyData.id, trajectoryId || "", hypothesis)
      );
    } else {
      results.push({
        paper: paperTitle,
        study: "",
        status: `error: ${outcome.reason?.message || "unknown"}`,
      });
    }
  }

  // Let reviews run in background after response
  Promise.allSettled(backgroundReviews).then((s) => {
    const ok = s.filter((r) => r.status === "fulfilled").length;
    console.log(`Background reviews done: ${ok}/${s.length} succeeded`);
  });

  return NextResponse.json({ total: results.length, results });
}
