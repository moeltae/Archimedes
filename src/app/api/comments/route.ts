import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/comments?experiment_id=...
export async function GET(req: NextRequest) {
  const experimentId = req.nextUrl.searchParams.get("experiment_id");
  if (!experimentId) {
    return NextResponse.json({ error: "experiment_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("experiment_id", experimentId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const { experiment_id, parent_id, session_id, author_name, body } = await req.json();

  if (!experiment_id || !session_id || !body?.trim()) {
    return NextResponse.json({ error: "experiment_id, session_id, and body are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      experiment_id,
      parent_id: parent_id || null,
      session_id,
      author_name: author_name?.trim() || "Anonymous",
      body: body.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/comments
export async function DELETE(req: NextRequest) {
  const { id, session_id } = await req.json();

  if (!id || !session_id) {
    return NextResponse.json({ error: "id and session_id required" }, { status: 400 });
  }

  // Only allow deleting own comments
  const { data: comment } = await supabase
    .from("comments")
    .select("session_id")
    .eq("id", id)
    .single();

  if (!comment || comment.session_id !== session_id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
