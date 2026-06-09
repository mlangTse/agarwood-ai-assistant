import { NextRequest, NextResponse } from "next/server";
import { ingestKnowledgeDocument } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传 Markdown / TXT / PDF 文件。" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const content = await extractText(file, buffer);
    if (!content.trim()) {
      return NextResponse.json({ error: "未能从文件中读取有效文本。" }, { status: 400 });
    }

    const result = await ingestKnowledgeDocument({
      title: file.name.replace(/\.[^.]+$/, ""),
      sourceName: file.name,
      mimeType: file.type,
      content
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    console.error("Knowledge upload failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `上传失败：${error.message}`
            : "上传失败：服务器处理知识库文件时出错。"
      },
      { status: 500 }
    );
  }
}

async function extractText(file: File, buffer: Buffer) {
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const { default: pdf } = await import("pdf-parse");
    const parsed = await pdf(buffer);
    return parsed.text;
  }
  return buffer.toString("utf8");
}
