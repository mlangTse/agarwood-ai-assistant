import { NextResponse } from "next/server";
import { listKnowledgeDocuments } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listKnowledgeDocuments();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "读取知识库记录失败。"
      },
      { status: 500 }
    );
  }
}
