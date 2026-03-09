import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — fetch a completed analysis job's full results
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const { data: job, error } = await supabase
    .from("analysis_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
