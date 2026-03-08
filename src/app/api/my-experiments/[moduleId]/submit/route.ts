import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST — submit results for a module
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params;
  const { session_id, results_summary, results_data, notes, submission_type, file_urls } =
    await req.json();

  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Verify ownership via claimed_by on modules
  const { data: mod } = await supabase
    .from("modules")
    .select("id, assigned_lab, claimed_by")
    .eq("id", moduleId)
    .eq("claimed_by", session_id)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Not your module" }, { status: 403 });
  }

  // Create submission
  const { data, error } = await supabase
    .from("data_submissions")
    .insert({
      module_id: moduleId,
      session_id,
      submitted_by_lab: mod.assigned_lab || "Unknown",
      submission_type: submission_type || "results",
      results_summary: results_summary || "",
      results_data: results_data || {},
      file_urls: file_urls || [],
      notes: notes || "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark module as completed if full results
  if (submission_type === "results") {
    await supabase
      .from("modules")
      .update({ status: "completed" })
      .eq("id", moduleId);
  }

  return NextResponse.json({ submission: data });
}
