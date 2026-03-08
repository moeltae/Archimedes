import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// PATCH — update module status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status, session_id } = await req.json();

  const valid = ["claimed", "in_progress", "completed"];
  if (!valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Verify ownership
  const { data: claim } = await supabase
    .from("module_claims")
    .select("id")
    .eq("module_id", id)
    .eq("session_id", session_id)
    .single();

  if (!claim) {
    return NextResponse.json({ error: "Not your module" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("modules")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ module: data });
}
