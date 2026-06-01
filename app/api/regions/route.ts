import { NextResponse } from "next/server";
import { regionNotes } from "@/lib/sample-data";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ regions: regionNotes, mode: "demo" });

  const { data, error } = await supabase.from("incense_regions").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ regions: data, mode: "supabase" });
}
