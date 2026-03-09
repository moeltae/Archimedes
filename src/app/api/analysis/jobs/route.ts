import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/analysis/jobs — fetch all analysis jobs with module/study context
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  // Find all modules the user has claimed, plus AI analysis modules in the same studies
  let moduleIds: string[] = [];

  if (sessionId) {
    // Get studies where the user has claimed a module
    const { data: userModules } = await supabase
      .from("modules")
      .select("id, experiment_id")
      .eq("claimed_by", sessionId);

    const studyIds = [
      ...new Set((userModules || []).map((m) => m.experiment_id)),
    ];

    if (studyIds.length > 0) {
      // Get all modules in those studies (including AI-owned analysis modules)
      const { data: allModules } = await supabase
        .from("modules")
        .select("id")
        .in("experiment_id", studyIds);

      moduleIds = (allModules || []).map((m) => m.id);
    }
  }

  if (moduleIds.length === 0) {
    return NextResponse.json({ jobs: [] });
  }

  // Fetch analysis jobs for these modules with context
  const { data: jobs, error } = await supabase
    .from("analysis_jobs")
    .select(
      "*, module:modules(id, module_name, experiment_id, is_analysis, assigned_lab, experiment:experiments(id, title, tags))"
    )
    .in("module_id", moduleIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs || [] });
}
