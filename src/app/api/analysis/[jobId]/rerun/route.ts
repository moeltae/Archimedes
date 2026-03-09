import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { runAnalysis } from "@/lib/analysis";

// POST — trigger re-analysis with optional follow-up prompt
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { follow_up_prompt } = await req.json();

  // Get the original job to find submission_id and module_id
  const { data: originalJob } = await supabase
    .from("analysis_jobs")
    .select("submission_id, module_id")
    .eq("id", jobId)
    .single();

  if (!originalJob) {
    return NextResponse.json({ error: "Original job not found" }, { status: 404 });
  }

  // Create a new analysis job
  const { data: newJob, error } = await supabase
    .from("analysis_jobs")
    .insert({
      submission_id: originalJob.submission_id,
      module_id: originalJob.module_id,
      status: "pending",
      follow_up_prompt: follow_up_prompt || null,
    })
    .select()
    .single();

  if (error || !newJob) {
    return NextResponse.json(
      { error: error?.message || "Failed to create re-analysis job" },
      { status: 500 }
    );
  }

  // Fire-and-forget
  runAnalysis(
    newJob.id,
    originalJob.submission_id,
    originalJob.module_id,
    follow_up_prompt
  ).catch((err) => console.error("[analysis/rerun] Background error:", err));

  return NextResponse.json({ job_id: newJob.id, status: "pending" });
}
