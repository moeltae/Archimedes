import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Only allow deleting rejected studies whose countdown has expired
  const { data: study } = await supabase
    .from("experiments")
    .select("status, rejected_at")
    .eq("id", id)
    .single();

  if (!study) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (study.status !== "rejected" || !study.rejected_at) {
    return NextResponse.json(
      { error: "Only expired rejected studies can be deleted" },
      { status: 403 }
    );
  }

  const expiresAt = new Date(study.rejected_at).getTime() + 60 * 60 * 1000;
  if (Date.now() < expiresAt) {
    return NextResponse.json(
      { error: "Countdown has not expired yet" },
      { status: 403 }
    );
  }

  // Cascade delete: paper will cascade-delete experiments, modules, votes, etc.
  const { data: experiment } = await supabase
    .from("experiments")
    .select("paper_id")
    .eq("id", id)
    .single();

  if (experiment?.paper_id) {
    await supabase.from("papers").delete().eq("id", experiment.paper_id);
  } else {
    await supabase.from("experiments").delete().eq("id", id);
  }

  return NextResponse.json({ deleted: true });
}
