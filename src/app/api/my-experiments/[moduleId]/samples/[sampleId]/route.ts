import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// PATCH — update sample status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string; sampleId: string }> }
) {
  const { sampleId } = await params;
  const { status, file_urls } = await req.json();

  const updates: Record<string, unknown> = {};

  if (status) {
    const validStatuses = ["pending", "in_progress", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = status;
    if (status === "completed") {
      updates.processed_at = new Date().toISOString();
    } else {
      updates.processed_at = null;
    }
  }

  if (file_urls !== undefined) {
    updates.file_urls = file_urls;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("samples")
    .update(updates)
    .eq("id", sampleId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sample: data });
}
