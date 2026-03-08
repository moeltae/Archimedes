import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { allocateModuleBudgets } from "@/lib/openai";

// POST — trigger AI budget allocation for a study's modules
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get study details
  const { data: study, error: studyError } = await supabase
    .from("experiments")
    .select("title, hypothesis, study_design, funding_goal")
    .eq("id", id)
    .single();

  if (studyError || !study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  // Get modules
  const { data: modules, error: modError } = await supabase
    .from("modules")
    .select("id, module_name, description, expertise_required")
    .eq("experiment_id", id)
    .order("created_at", { ascending: true });

  if (modError || !modules || modules.length === 0) {
    return NextResponse.json({ error: "No modules to allocate" }, { status: 400 });
  }

  // Call AI to allocate
  const allocations = await allocateModuleBudgets({
    title: study.title,
    hypothesis: study.hypothesis,
    study_design: study.study_design,
    funding_goal: study.funding_goal,
    modules,
  });

  // Update each module with its allocation
  const updateResults = await Promise.all(
    allocations.map(async (alloc) => {
      const { error } = await supabase
        .from("modules")
        .update({ budget_pct: alloc.percent, budget_rationale: alloc.rationale })
        .eq("id", alloc.id);
      if (error) {
        console.error(`Failed to update module ${alloc.id}:`, error.message);
      }
      return { id: alloc.id, error: error?.message ?? null };
    })
  );

  const failed = updateResults.filter((r) => r.error);
  if (failed.length > 0) {
    return NextResponse.json(
      { error: "Some modules failed to update. Have you added budget_pct and budget_rationale columns to the modules table?", allocations, failed },
      { status: 500 }
    );
  }

  return NextResponse.json({ allocations });
}
