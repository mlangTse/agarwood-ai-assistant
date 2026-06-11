import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const RAW_DIR = path.join(process.cwd(), "knowledge", "raw");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((file): file is File => file instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "请上传 Markdown / TXT / PDF 文件。" }, { status: 400 });
    }

    await mkdir(RAW_DIR, { recursive: true });

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
        const rawName = rawMarkdownName(file.name);
        const rawPath = path.join(RAW_DIR, rawName);
        await writeFile(rawPath, normalizeRawMarkdown(file, content), "utf8");
        results.push({ fileName: file.name, rawName, ok: true });
      } catch (error) {
        results.push({
          fileName: file.name,
          ok: false,
          error: error instanceof Error ? error.message : "写入 raw 失败。"
        });
      }
    }

    const succeeded = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    if (succeeded.length === 0) {
      return NextResponse.json(
        { results, error: failed[0]?.error ?? "没有文件成功写入 raw。" },
        { status: 400 }
      );
    }

    const wikiBuild = await runNodeScript("scripts/build-llm-wiki.mjs");
    const wikiSync = await runNodeScript("scripts/sync-llm-wiki-rag.mjs");

    return NextResponse.json(
      {
        mode: process.env.DATABASE_URL ? "llm-wiki+postgresql" : "llm-wiki",
        files: results.length,
        succeeded: succeeded.length,
        failed: failed.length,
        rawFiles: succeeded.map((result) => result.rawName),
        wikiBuild,
        wikiSync,
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
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { default: pdf } = await import("pdf-parse");
    const parsed = await pdf(buffer);
    return parsed.text;
  }
  return buffer.toString("utf8");
}

function rawMarkdownName(fileName: string) {
  const parsed = path.parse(fileName);
  const base = (parsed.name || "uploaded-source")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "uploaded-source"}.md`;
}

function normalizeRawMarkdown(file: File, content: string) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    return content.replace(/\r\n/g, "\n");
  }

  return [
    "---",
    `title: ${JSON.stringify(path.parse(file.name).name)}`,
    `source_file: ${JSON.stringify(file.name)}`,
    `ingested_at: ${JSON.stringify(new Date().toISOString())}`,
    "---",
    "",
    `# ${path.parse(file.name).name}`,
    "",
    content.replace(/\r\n/g, "\n").trim(),
    ""
  ].join("\n");
}

async function runNodeScript(scriptPath: string) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 300_000,
    maxBuffer: 1024 * 1024 * 8
  });

  const trimmed = stdout.trim();
  let parsed: unknown = trimmed;
  try {
    parsed = trimmed ? JSON.parse(trimmed) : {};
  } catch {
    // Some scripts can print a plain status line, for example when DATABASE_URL is absent.
  }

  return {
    ok: true,
    stdout: parsed,
    stderr: stderr.trim() || undefined
  };
}
