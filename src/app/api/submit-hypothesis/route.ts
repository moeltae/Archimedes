import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkHypothesisNovelty, generateStudy, decomposeStudy } from "@/lib/openai";
import { checkNovelty } from "@/lib/futurehouse";

export async function POST(req: NextRequest) {
  const { hypothesis, context, tags: userTags } = await req.json();

  if (!hypothesis) {
    return NextResponse.json(
      { error: "Hypothesis is required" },
      { status: 400 }
    );
  }

  // Step 1: Check against existing studies in our database
  const { data: existing } = await supabase
    .from("experiments")
    .select("id, title, hypothesis")
    .textSearch("hypothesis", hypothesis.split(" ").slice(0, 5).join(" & "), {
      type: "websearch",
    });

  const duplicates = existing || [];

  // Step 2: Check novelty via FutureHouse (falls back to OpenAI)
  let noveltyResult = await checkNovelty(hypothesis);
  if (!noveltyResult) {
    // Fallback to OpenAI-based novelty check
    noveltyResult = await checkHypothesisNovelty(hypothesis);
  }

  // Step 3: If novel enough, create a paper + study from it
  if (noveltyResult && (noveltyResult.novelty_score >= 5 || noveltyResult.is_novel)) {
    // Create a synthetic "paper" entry for user-submitted hypotheses
    const { data: paper } = await supabase
      .from("papers")
      .insert({
        title: `User Hypothesis: ${hypothesis.slice(0, 80)}`,
        abstract: context || hypothesis,
        claims: hypothesis,
        research_gap: "User-proposed research direction",
        source_url: null,
      })
      .select()
      .single();

    if (paper) {
      const study = await generateStudy({
        title: paper.title,
        abstract: paper.abstract,
        claims: paper.claims,
        research_gap: paper.research_gap,
      });

      const { data: studyData } = await supabase
        .from("experiments")
        .insert({
          paper_id: paper.id,
          title: study.title,
          hypothesis,
          study_design: study.study_design,
          funding_goal: study.funding_goal,
          tags: userTags?.length > 0 ? userTags : study.tags || [],
          funded_amount: 0,
          upvotes: 0,
          downvotes: 0,
          status: "proposed",
        })
        .select()
        .single();

      if (studyData) {
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
      }

      return NextResponse.json({
        status: "created",
        novelty: noveltyResult,
        experiment: studyData,
        similar_existing: duplicates,
      });
    }
  }

  // Store the rejected hypothesis so users can see it with the countdown
  // Create a paper + experiment entry with rejected status
  const { data: rejectedPaper } = await supabase
    .from("papers")
    .insert({
      title: `User Hypothesis: ${hypothesis.slice(0, 80)}`,
      abstract: context || hypothesis,
      claims: hypothesis,
      research_gap: "User-proposed research direction",
      source_url: null,
    })
    .select()
    .single();

  let rejectedExperiment = null;
  if (rejectedPaper) {
    const { data: rejData } = await supabase
      .from("experiments")
      .insert({
        paper_id: rejectedPaper.id,
        title: `Rejected: ${hypothesis.slice(0, 80)}`,
        hypothesis,
        study_design: null,
        funding_goal: 0,
        tags: userTags?.length > 0 ? userTags : [],
        funded_amount: 0,
        upvotes: 0,
        downvotes: 0,
        status: "rejected",
        novelty_score: noveltyResult?.novelty_score ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        review_explanation: (noveltyResult as any)?.similar_work || noveltyResult?.explanation || "Prior work exists for this hypothesis.",
        rejected_at: new Date().toISOString(),
      })
      .select()
      .single();
    rejectedExperiment = rejData;
  }

  return NextResponse.json({
    status: "rejected",
    novelty: noveltyResult,
    experiment: rejectedExperiment,
    similar_existing: duplicates,
    message:
      "This hypothesis doesn't appear novel enough. See similar work below.",
  });
}
