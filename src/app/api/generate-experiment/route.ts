import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateStudy, decomposeStudy } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { paper_id } = await req.json();

  if (!paper_id) {
    return NextResponse.json(
      { error: "paper_id is required" },
      { status: 400 }
    );
  }

  // Fetch the paper
  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .select("*")
    .eq("id", paper_id)
    .single();

  if (paperError || !paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Generate study proposal
  const study = await generateStudy(paper);

  // Insert study
  const { data: studyData, error: studyError } = await supabase
    .from("experiments")
    .insert({
      paper_id,
      title: study.title,
      hypothesis: study.hypothesis,
      study_design: study.study_design,
      funding_goal: study.funding_goal,
      tags: study.tags || [],
      funded_amount: 0,
      upvotes: 0,
      downvotes: 0,
      status: "proposed",
    })
    .select()
    .single();

  if (studyError) {
    return NextResponse.json({ error: studyError.message }, { status: 500 });
  }

  // Decompose into experiments
  const experiments = await decomposeStudy(study);

  const AI_AGENT_SESSION = "archimedes-ai";
  const AI_AGENT_LAB = "Archimedes AI";

  const experimentInserts = experiments.map(
    (e: {
      module_name: string;
      description: string;
      expertise_required: string;
      is_analysis?: boolean;
    }) => ({
      experiment_id: studyData.id,
      module_name: e.module_name,
      description: e.description,
      expertise_required: e.expertise_required,
      is_analysis: e.is_analysis || false,
      // AI agent auto-claims analysis modules
      status: e.is_analysis ? "claimed" : "open",
      assigned_lab: e.is_analysis ? AI_AGENT_LAB : null,
      claimed_by: e.is_analysis ? AI_AGENT_SESSION : null,
    })
  );

  await supabase.from("modules").insert(experimentInserts);

  return NextResponse.json(studyData);
}
