import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getEdisonTask, parseNoveltyResult } from "@/lib/futurehouse";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") || "hot";
  const tag = searchParams.get("tag");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // Fix stale pending_review studies stuck for >10 minutes
  // This catches studies whose background review was killed in serverless
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: staleStudies } = await supabase
    .from("experiments")
    .select("id, novelty_score, review_explanation, review_task_id")
    .eq("status", "pending_review")
    .lt("created_at", tenMinutesAgo);

  if (staleStudies && staleStudies.length > 0) {
    await Promise.all(staleStudies.slice(0, 5).map(async (s) => {
      // Case 1: Already has review results but status wasn't updated
      if (s.review_explanation) {
        const newStatus = (s.novelty_score ?? 0) >= 5 ? "proposed" : "rejected";
        const update: Record<string, unknown> = { status: newStatus };
        if (newStatus === "rejected") update.rejected_at = new Date().toISOString();
        await supabase.from("experiments").update(update).eq("id", s.id);
        return;
      }

      // Case 2: Has a FutureHouse task — check if it completed
      if (s.review_task_id) {
        try {
          const result = await getEdisonTask(s.review_task_id);
          if (result && result.status === "success") {
            const parsed = parseNoveltyResult(result);
            const newStatus = parsed.is_novel ? "proposed" : "rejected";
            const update: Record<string, unknown> = {
              status: newStatus,
              novelty_score: parsed.novelty_score,
              review_explanation: parsed.explanation.slice(0, 5000),
            };
            if (newStatus === "rejected") update.rejected_at = new Date().toISOString();
            await supabase.from("experiments").update(update).eq("id", s.id);
            return;
          }
          // Task still running on FutureHouse — leave as pending_review
          if (result && (result.status === "queued" || result.status === "in progress")) {
            return;
          }
          // Task failed/cancelled — fall through to default
        } catch {
          // FutureHouse unreachable — fall through to default
        }
      }

      // Case 3: No task ID, or task failed — default to proposed
      await supabase.from("experiments").update({
        status: "proposed",
        novelty_score: 5,
      }).eq("id", s.id);
    }));
  }

  // Backfill rejected_at for any rejected study missing it (starts their 1hr countdown now)
  await supabase
    .from("experiments")
    .update({ rejected_at: new Date().toISOString() })
    .eq("status", "rejected")
    .is("rejected_at", null);

  // Auto-delete rejected studies whose 1-hour countdown has expired
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await supabase
    .from("experiments")
    .delete()
    .eq("status", "rejected")
    .not("rejected_at", "is", null)
    .lt("rejected_at", oneHourAgo);

  let query = supabase
    .from("experiments")
    .select("*, paper:papers(*), experiments:modules(*), comments(*)", { count: "exact" });

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  switch (sort) {
    case "new":
      query = query.order("created_at", { ascending: false });
      break;
    case "top":
      query = query.order("upvotes", { ascending: false });
      break;
    case "funded":
      query = query.order("funded_amount", { ascending: false });
      break;
    case "hot":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiments: data, total: count, page });
}
