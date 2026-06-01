import { NextResponse } from "next/server";
import { regionNotes } from "@/lib/sample-data";
import { getDatabase } from "@/lib/db";

export async function GET() {
  const db = await getDatabase();
  if (!db) return NextResponse.json({ regions: regionNotes, mode: "demo" });

  try {
    const { rows } = await db.query("select * from incense_regions order by name");
    return NextResponse.json({ regions: rows, mode: "postgresql" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取产区失败。" },
      { status: 500 }
    );
  }
}
