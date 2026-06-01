import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/db";

const favoriteSchema = z.object({
  productId: z.string(),
  conversationId: z.string().optional(),
  note: z.string().optional()
});

export async function POST(request: NextRequest) {
  const payload = favoriteSchema.parse(await request.json());
  const db = await getDatabase();
  if (!db) return NextResponse.json({ ok: true, mode: "demo", favorite: payload });

  try {
    const { rows } = await db.query(
      `insert into recommendations (product_id, conversation_id, user_note, is_favorite)
       values ($1, $2, $3, true)
       returning *`,
      [payload.productId, payload.conversationId, payload.note]
    );
    return NextResponse.json({ ok: true, recommendation: rows[0], mode: "postgresql" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存收藏失败。" },
      { status: 500 }
    );
  }
}
