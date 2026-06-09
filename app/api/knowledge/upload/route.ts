import { NextRequest, NextResponse } from "next/server";
import { ingestKnowledgeDocument } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((file): file is File => file instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "请上传 Markdown / TXT / PDF 文件。" }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const content = await extractText(file, buffer);
      if (!content.trim()) {
        results.push({
          fileName: file.name,
          ok: false,
          error: "未能从文件中读取有效文本。"
        });
        continue;
      }

      try {
        const result = await ingestKnowledgeDocument({
          title: file.name.replace(/\.[^.]+$/, ""),
          sourceName: file.name,
          mimeType: file.type,
          content
        });
        results.push({ fileName: file.name, ok: true, ...result });
      } catch (error) {
        results.push({
          fileName: file.name,
          ok: false,
          error: error instanceof Error ? error.message : "入库失败。"
        });
      }
    }

    const succeeded = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    if (succeeded.length === 0) {
      return NextResponse.json(
        { results, error: failed[0]?.error ?? "没有文件成功入库。" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        mode: succeeded[0]?.mode ?? "local",
        files: results.length,
        succeeded: succeeded.length,
        failed: failed.length,
        chunks: succeeded.reduce((sum, result) => sum + ("chunks" in result ? Number(result.chunks) : 0), 0),
        results
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
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
