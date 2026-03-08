import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — list all modules claimed by this session
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Query modules directly by claimed_by session ID
  const { data: mods, error } = await supabase
    .from("modules")
    .select("*, experiment:experiments(title, hypothesis, study_design, funding_goal, funded_amount)")
    .eq("claimed_by", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with sample counts and funding data
  const modules = await Promise.all(
    (mods || []).map(async (mod) => {
      const experiment = mod.experiment as { title: string; hypothesis: string; study_design: string; funding_goal: number; funded_amount: number } | null;

      const { count: samplesTotal } = await supabase
        .from("samples")
        .select("*", { count: "exact", head: true })
        .eq("module_id", mod.id);

      const { count: samplesCompleted } = await supabase
        .from("samples")
        .select("*", { count: "exact", head: true })
        .eq("module_id", mod.id)
        .eq("status", "completed");

      const { count: submissionCount } = await supabase
        .from("data_submissions")
        .select("*", { count: "exact", head: true })
        .eq("module_id", mod.id);

      // Count total modules in this study for funding split
      const { count: totalModulesInStudy } = await supabase
        .from("modules")
        .select("*", { count: "exact", head: true })
        .eq("experiment_id", mod.experiment_id);

      return {
        id: mod.id,
        experiment_id: mod.experiment_id,
        module_name: mod.module_name,
        description: mod.description,
        expertise_required: mod.expertise_required,
        status: mod.status,
        assigned_lab: mod.assigned_lab,
        experiment_title: experiment?.title || "",
        experiment_hypothesis: experiment?.hypothesis || "",
        experiment_study_design: experiment?.study_design || "",
        claimed_at: mod.created_at,
        samples_total: samplesTotal || 0,
        samples_completed: samplesCompleted || 0,
        has_submission: (submissionCount || 0) > 0,
        study_funding_goal: experiment?.funding_goal || 0,
        study_funded_amount: experiment?.funded_amount || 0,
        total_modules_in_study: totalModulesInStudy || 1,
        budget_pct: mod.budget_pct ?? null,
        budget_rationale: mod.budget_rationale ?? null,
      };
    })
  );

  return NextResponse.json({ modules });
}
