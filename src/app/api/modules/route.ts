import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST — add a new module/section
export async function POST(req: NextRequest) {
  const { experiment_id, module_name } = await req.json();

  if (!experiment_id || !module_name?.trim()) {
    return NextResponse.json({ error: "experiment_id and module_name required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("modules")
    .insert({
      experiment_id,
      module_name: module_name.trim(),
      description: "",
      expertise_required: "",
      status: "open",
      assigned_lab: null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ module: data });
}
