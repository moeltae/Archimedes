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

  // Auto-trigger AI analysis in the background
  if (data && (submission_type === "results" || submission_type === "partial")) {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      req.nextUrl.origin;

    // 1. Trigger analysis for the submitting module itself
    fetch(`${baseUrl}/api/analysis/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: data.id,
        module_id: moduleId,
        session_id,
      }),
    }).catch((err) =>
      console.error("[submit] Failed to trigger analysis:", err)
    );

    // 2. Auto-trigger AI-owned analysis modules in the same study
    // These are sibling modules marked as is_analysis and claimed by the AI agent
    (async () => {
      try {
        // Find the parent experiment for this module
        const { data: thisModule } = await supabase
          .from("modules")
          .select("experiment_id")
          .eq("id", moduleId)
          .single();

        if (!thisModule) return;

        // Find AI-owned analysis modules in the same study
        const { data: analysisModules } = await supabase
          .from("modules")
          .select("id")
          .eq("experiment_id", thisModule.experiment_id)
          .eq("is_analysis", true)
          .eq("claimed_by", "archimedes-ai")
          .neq("id", moduleId); // skip if the submitting module is itself an analysis module

        if (analysisModules && analysisModules.length > 0) {
          for (const analysisMod of analysisModules) {
            fetch(`${baseUrl}/api/analysis/trigger`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                submission_id: data.id,
                module_id: analysisMod.id, // analysis module's context guides the analysis
                session_id: "archimedes-ai",
              }),
            }).catch((err) =>
              console.error("[submit] Failed to trigger AI analysis module:", err)
            );
          }
        }
      } catch (err) {
        console.error("[submit] Failed to check for AI analysis modules:", err);
      }
    })();
  }

  return NextResponse.json({ submission: data });
}
