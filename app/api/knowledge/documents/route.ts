import { NextResponse } from "next/server";
import { listKnowledgeDocuments } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const result = await listKnowledgeDocuments();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "读取知识库记录失败。"
      },
      { status: 500 }
    );
  }
}
