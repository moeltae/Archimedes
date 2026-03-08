import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSamples } from "@/lib/openai";

// POST — volunteer a lab for a module
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { lab_name, session_id } = await req.json();

  if (!lab_name?.trim()) {
    return NextResponse.json({ error: "lab_name required" }, { status: 400 });
  }
  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Check module is still open
  const { data: mod } = await supabase
    .from("modules")
    .select("*, experiment:experiments(title, hypothesis, study_design)")
    .eq("id", id)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
  if (mod.status !== "open") {
    return NextResponse.json({ error: "Module already claimed" }, { status: 409 });
  }

  // Update module status
  const { data, error } = await supabase
    .from("modules")
    .update({ assigned_lab: lab_name.trim(), status: "claimed", claimed_by: session_id })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also try to create claim record (table may not exist in all environments)
  try {
    await supabase.from("module_claims").insert({
      module_id: id,
      session_id,
      lab_name: lab_name.trim(),
    });
  } catch {
    // table may not exist — that's fine
  }

  // Generate samples in background (don't block response)
  const experiment = mod.experiment as { title: string; hypothesis: string; study_design: string } | null;
  generateSamples({
    module_name: mod.module_name,
    description: mod.description || "",
    expertise_required: mod.expertise_required || "",
    study_title: experiment?.title || "",
    study_design: experiment?.study_design || "",
  })
    .then(async (samples: { sample_name: string; description: string }[]) => {
      if (Array.isArray(samples) && samples.length > 0) {
        await supabase.from("samples").insert(
          samples.map((s) => ({
            module_id: id,
            sample_name: s.sample_name,
            description: s.description,
          }))
        );
      }
    })
    .catch((err) => {
      console.error("Failed to generate samples:", err);
    });

  return NextResponse.json({ module: data });
}

// DELETE — unclaim a module
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Verify the module is claimed by this session
  const { data: mod } = await supabase
    .from("modules")
    .select("id, claimed_by, status")
    .eq("id", id)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
  if (mod.claimed_by !== sessionId) {
    return NextResponse.json({ error: "Not your claim" }, { status: 403 });
  }

  // Reset the module
  const { error } = await supabase
    .from("modules")
    .update({ assigned_lab: null, status: "open", claimed_by: null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clean up samples generated for this claim
  await supabase.from("samples").delete().eq("module_id", id);

  // Clean up module_claims if table exists
  try {
    await supabase.from("module_claims").delete().eq("module_id", id).eq("session_id", sessionId);
  } catch {
    // table may not exist
  }

  return NextResponse.json({ ok: true });
}
