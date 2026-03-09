import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const experimentId = searchParams.get("experiment_id");
  const sessionId = searchParams.get("session_id");

  if (!experimentId || !sessionId) {
    return NextResponse.json({ vote_type: null });
  }

  const { data } = await supabase
    .from("votes")
    .select("vote_type")
    .eq("experiment_id", experimentId)
    .eq("session_id", sessionId)
    .single();

  return NextResponse.json({ vote_type: data?.vote_type || null });
}

export async function POST(req: NextRequest) {
  const { experiment_id, vote_type, session_id } = await req.json();

  if (!experiment_id || !vote_type || !session_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (vote_type !== "up" && vote_type !== "down") {
    return NextResponse.json({ error: "Invalid vote_type" }, { status: 400 });
  }

  // Check if user already voted on this experiment
  const { data: existing } = await supabase
    .from("votes")
    .select("*")
    .eq("experiment_id", experiment_id)
    .eq("session_id", session_id)
    .single();

  // Helper to get current vote counts
  async function getCounts() {
    const { data } = await supabase
      .from("experiments")
      .select("upvotes, downvotes")
      .eq("id", experiment_id)
      .single();
    return {
      upvotes: (data as { upvotes: number; downvotes: number } | null)?.upvotes ?? 0,
      downvotes: (data as { upvotes: number; downvotes: number } | null)?.downvotes ?? 0,
    };
  }

  if (existing) {
    if (existing.vote_type === vote_type) {
      // Remove vote (toggle off)
      await supabase.from("votes").delete().eq("id", existing.id);

      const counts = await getCounts();
      const update =
        vote_type === "up"
          ? { upvotes: Math.max(0, counts.upvotes - 1) }
          : { downvotes: Math.max(0, counts.downvotes - 1) };

      await supabase.from("experiments").update(update).eq("id", experiment_id);

      return NextResponse.json({ action: "removed" });
    } else {
      // Switch vote
      await supabase
        .from("votes")
        .update({ vote_type })
        .eq("id", existing.id);

      const counts = await getCounts();
      const update =
        vote_type === "up"
          ? {
              upvotes: counts.upvotes + 1,
              downvotes: Math.max(0, counts.downvotes - 1),
            }
          : {
              downvotes: counts.downvotes + 1,
              upvotes: Math.max(0, counts.upvotes - 1),
            };

      await supabase.from("experiments").update(update).eq("id", experiment_id);

      return NextResponse.json({ action: "switched" });
    }
  }

  // New vote
  await supabase.from("votes").insert({
    experiment_id,
    vote_type,
    session_id,
  });

  const counts = await getCounts();
  const update =
    vote_type === "up"
      ? { upvotes: counts.upvotes + 1 }
      : { downvotes: counts.downvotes + 1 };

  await supabase.from("experiments").update(update).eq("id", experiment_id);

  // Community override: if a rejected study gets enough upvotes, promote it
  const OVERRIDE_THRESHOLD = 10;
  const newUpvotes = vote_type === "up" ? counts.upvotes + 1 : counts.upvotes;
  const newDownvotes = vote_type === "down" ? counts.downvotes + 1 : counts.downvotes;
  const netScore = newUpvotes - newDownvotes;

  if (netScore >= OVERRIDE_THRESHOLD) {
    const { data: study } = await supabase
      .from("experiments")
      .select("status")
      .eq("id", experiment_id)
      .single();

    if (study && study.status === "rejected") {
      await supabase
        .from("experiments")
        .update({ status: "proposed", rejected_at: null })
        .eq("id", experiment_id);
      return NextResponse.json({ action: "voted", community_override: true });
    }
  }

  return NextResponse.json({ action: "voted" });
}
