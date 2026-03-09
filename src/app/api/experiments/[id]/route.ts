import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// PATCH — update study fields (title, hypothesis, study_design)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowed = ["title", "hypothesis", "study_design"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined && typeof body[key] === "string" && body[key].trim()) {
      updates[key] = body[key].trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("experiments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ study: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: study } = await supabase
    .from("experiments")
    .select("status, rejected_at, paper_id")
    .eq("id", id)
    .single();

  if (!study) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check if this is a user-submitted study (paper.source_url is null)
  let isUserSubmitted = false;
  if (study.paper_id) {
    const { data: paper } = await supabase
      .from("papers")
      .select("source_url")
      .eq("id", study.paper_id)
      .single();
    isUserSubmitted = paper ? !paper.source_url : false;
  }

  // Allow deletion if: user-submitted study, OR expired rejected study
  const isExpiredRejected =
    study.status === "rejected" &&
    study.rejected_at &&
    Date.now() >= new Date(study.rejected_at).getTime() + 60 * 60 * 1000;

  if (!isUserSubmitted && !isExpiredRejected) {
    return NextResponse.json(
      { error: "Only user-submitted or expired rejected studies can be deleted" },
      { status: 403 }
    );
  }

  // Cascade delete via paper (paper FK cascades to experiments, modules, votes, etc.)
  if (study.paper_id) {
    await supabase.from("papers").delete().eq("id", study.paper_id);
  } else {
    await supabase.from("experiments").delete().eq("id", id);
  }

  return NextResponse.json({ deleted: true });
}
