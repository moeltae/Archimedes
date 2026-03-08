import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSamples } from "@/lib/openai";

// GET — full detail for a claimed module
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params;
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Get module with parent experiment, verify ownership via claimed_by
  const { data: mod } = await supabase
    .from("modules")
    .select("*, experiment:experiments(title, hypothesis, study_design, tags, status, funding_goal, funded_amount)")
    .eq("id", moduleId)
    .eq("claimed_by", sessionId)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Not your module" }, { status: 403 });
  }

  // Count total modules in this study for funding split
  const { count: totalModulesInStudy } = await supabase
    .from("modules")
    .select("*", { count: "exact", head: true })
    .eq("experiment_id", mod.experiment_id);

  // Get samples
  let { data: samples } = await supabase
    .from("samples")
    .select("*")
    .eq("module_id", moduleId)
    .order("created_at", { ascending: true });

  // If no samples exist yet, generate them on-demand
  if (!samples || samples.length === 0) {
    const experiment = mod.experiment as {
      title: string; hypothesis: string; study_design: string;
    } | null;

    try {
      console.log("[samples] Generating for module:", mod.module_name, "study:", experiment?.title);
      const generated = await generateSamples({
        module_name: mod.module_name,
        description: mod.description || "",
        expertise_required: mod.expertise_required || "",
        study_title: experiment?.title || "",
        study_design: experiment?.study_design || "",
      });
      console.log("[samples] Generated type:", typeof generated, "isArray:", Array.isArray(generated), "value:", JSON.stringify(generated).slice(0, 300));

      // Handle case where generated might be wrapped in an object
      const sampleList = Array.isArray(generated) ? generated : (generated as Record<string, unknown>)?.samples as unknown[] || [];

      if (Array.isArray(sampleList) && sampleList.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from("samples")
          .insert(
            sampleList.map((s: { sample_name: string; description: string }) => ({
              module_id: moduleId,
              sample_name: s.sample_name,
              description: s.description,
            }))
          )
          .select();
        if (insertErr) {
          console.error("[samples] Insert error:", insertErr.message);
        }
        console.log("[samples] Inserted:", inserted?.length || 0);
        samples = inserted || [];
      }
    } catch (err) {
      console.error("[samples] Failed to generate:", err);
      // Return the error for debugging
      return NextResponse.json({
        module: { ...mod, total_modules_in_study: totalModulesInStudy || 1 },
        samples: [],
        submissions: [],
        sample_error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Get submissions
  const { data: submissions } = await supabase
    .from("data_submissions")
    .select("*")
    .eq("module_id", moduleId)
    .order("submitted_at", { ascending: false });

  return NextResponse.json({
    module: { ...mod, total_modules_in_study: totalModulesInStudy || 1 },
    samples: samples || [],
    submissions: submissions || [],
  });
}
