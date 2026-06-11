import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceName = "agarwood-regions-research.md";
const title = "沉香产区、种植与野生资料库";
const sourcePath = path.join(root, "knowledge", "raw", sourceName);
const knowledgePath = path.join(root, "data", "knowledge-documents.json");

function chunkText(text, chunkSize = 900, overlap = 140) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end).trim());
    start = end - overlap;
    if (start < 0) start = 0;
    if (end === normalized.length) break;
  }
  return chunks.filter(Boolean);
}

async function readDocuments() {
  try {
    const content = await readFile(knowledgePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    throw error;
  }
}

const content = await readFile(sourcePath, "utf8");
const chunks = chunkText(content);
const id = randomUUID();
const document = {
  id,
  title,
  sourceName,
  mimeType: "text/markdown",
  content,
  createdAt: new Date().toISOString(),
  chunks: chunks.map((chunk, index) => ({
    id: `${id}-${index}`,
    documentId: id,
    title,
    content: chunk,
    metadata: {
      sourceName,
      chunkIndex: index
    }
  }))
};

const existing = await readDocuments();
const filtered = existing.filter((item) => item.title !== title && item.sourceName !== sourceName);
await mkdir(path.dirname(knowledgePath), { recursive: true });
await writeFile(knowledgePath, `${JSON.stringify([document, ...filtered], null, 2)}\n`, "utf8");

console.log(JSON.stringify({ title, sourceName, chunks: chunks.length, mode: "local" }));
