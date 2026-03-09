import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { decomposeStudy } from "@/lib/openai";

const AI_AGENT_SESSION = "archimedes-ai";
const AI_AGENT_LAB = "Archimedes AI";

// POST — re-decompose all studies' modules with is_analysis tagging
// Preserves study-level data (votes, comments, funding)
// Deletes old modules (cascades to samples, claims, submissions)
export async function POST() {
  const { data: studies, error } = await supabase
    .from("experiments")
    .select("id, title, hypothesis, study_design")
    .order("created_at", { ascending: true });

  if (error || !studies) {
    return NextResponse.json({ error: error?.message || "No studies found" }, { status: 500 });
  }

  // Delete all old modules in one shot
  const studyIds = studies.map((s) => s.id);
  await supabase.from("modules").delete().in("experiment_id", studyIds);

  // Re-decompose all studies in parallel
  const settled = await Promise.allSettled(
    studies.map(async (study) => {
      const experiments = await decomposeStudy({
        title: study.title,
        hypothesis: study.hypothesis,
        study_design: study.study_design || "",
      });

      const inserts = experiments.map(
        (e: {
          module_name: string;
          description: string;
          expertise_required: string;
          is_analysis?: boolean;
        }) => ({
          experiment_id: study.id,
          module_name: e.module_name,
          description: e.description,
          expertise_required: e.expertise_required,
          is_analysis: e.is_analysis || false,
          status: e.is_analysis ? "claimed" : "open",
          assigned_lab: e.is_analysis ? AI_AGENT_LAB : null,
          claimed_by: e.is_analysis ? AI_AGENT_SESSION : null,
        })
      );

      await supabase.from("modules").insert(inserts);

      return {
        id: study.id,
        title: study.title,
        modules: inserts.length,
        analysis: inserts.filter((m: { is_analysis: boolean }) => m.is_analysis).length,
      };
    })
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<{ id: string; title: string; modules: number; analysis: number }> => r.status === "fulfilled")
    .map((r) => r.value);

  const failed = settled.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    refreshed: results.length,
    failed,
    studies: results,
  });
}
