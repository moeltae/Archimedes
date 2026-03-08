import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") || "hot";
  const tag = searchParams.get("tag");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

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
    case "review":
      query = query.in("status", ["pending_review", "rejected"]);
      query = query.order("created_at", { ascending: false });
      break;
    case "hot":
    default:
      // Hot = upvotes - downvotes weighted by recency
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
