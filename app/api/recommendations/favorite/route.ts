import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const favoriteSchema = z.object({
  productId: z.string(),
  conversationId: z.string().optional(),
  note: z.string().optional()
});

export async function POST(request: NextRequest) {
  const payload = favoriteSchema.parse(await request.json());
  const supabase = await getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true, mode: "demo", favorite: payload });

  const { data, error } = await supabase
    .from("recommendations")
    .insert({
      product_id: payload.productId,
      conversation_id: payload.conversationId,
      user_note: payload.note,
      is_favorite: true
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recommendation: data, mode: "supabase" });
}
