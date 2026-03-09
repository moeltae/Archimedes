import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cancelAnalysis } from "@/lib/analysis";

// POST — cancel a running analysis job
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Verify job exists and is in a running state
  const { data: job } = await supabase
    .from("analysis_jobs")
    .select("id, status")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const terminalStatuses = ["completed", "failed", "cancelled"];
  if (terminalStatuses.includes(job.status)) {
    return NextResponse.json(
      { error: "Job is already in a terminal state", status: job.status },
      { status: 400 }
    );
  }

  // Signal the in-memory abort controller
  const wasCancelled = cancelAnalysis(jobId);

  // Update DB status regardless (in case the process already finished
  // or the job is running on a different instance)
  await supabase
    .from("analysis_jobs")
    .update({ status: "cancelled", error_message: "Analysis was cancelled by user" })
    .eq("id", jobId);

  return NextResponse.json({
    cancelled: true,
    was_running: wasCancelled,
  });
}
