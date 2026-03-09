import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { runAnalysis } from "@/lib/analysis";

// POST — trigger AI analysis for a data submission
export async function POST(req: NextRequest) {
  const { submission_id, module_id, session_id, follow_up_prompt } =
    await req.json();

  if (!submission_id || !module_id) {
    return NextResponse.json(
      { error: "submission_id and module_id required" },
      { status: 400 }
    );
  }

  // Verify submission exists
  const { data: submission } = await supabase
    .from("data_submissions")
    .select("id")
    .eq("id", submission_id)
    .single();

  if (!submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 }
    );
  }

  // Create analysis job row
  const { data: job, error } = await supabase
    .from("analysis_jobs")
    .insert({
      submission_id,
      module_id,
      status: "pending",
      follow_up_prompt: follow_up_prompt || null,
    })
    .select()
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: error?.message || "Failed to create analysis job" },
      { status: 500 }
    );
  }

  // Fire-and-forget: run the analysis pipeline asynchronously
  runAnalysis(job.id, submission_id, module_id, follow_up_prompt).catch(
    (err) => console.error("[analysis/trigger] Background error:", err)
  );

  return NextResponse.json({ job_id: job.id, status: "pending" });
}
