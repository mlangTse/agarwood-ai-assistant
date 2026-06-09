import { NextRequest, NextResponse } from "next/server";
import { deleteKnowledgeDocument } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await deleteKnowledgeDocument(params.id);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "删除知识库资料失败。"
      },
      { status: 404 }
    );
  }
}
