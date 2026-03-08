import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractPaperClaims } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { title, abstract, source_url } = await req.json();

  if (!title || !abstract) {
    return NextResponse.json(
      { error: "Title and abstract are required" },
      { status: 400 }
    );
  }

  const { claims, research_gap } = await extractPaperClaims(abstract, title);

  const { data, error } = await supabase
    .from("papers")
    .insert({
      title,
      abstract,
      claims,
      research_gap,
      source_url: source_url || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
