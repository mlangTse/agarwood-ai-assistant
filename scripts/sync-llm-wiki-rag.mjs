import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const wikiRoot = path.join(root, "knowledge", "wiki");
const dimensions = Number.parseInt(process.env.MODEL_EMBEDDING_DIMENSIONS ?? "1536", 10);
const timeoutMs = Number.parseInt(process.env.MODEL_API_TIMEOUT_MS ?? "30000", 10);

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

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(fullPath);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) return [fullPath];
      return [];
    })
  );
  return nested.flat();
}

function extractMarkdownTitle(content, fallback) {
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const match = withoutFrontmatter.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};

  const metadata = {};
  let currentKey = "";
  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trimEnd();
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyValue) {
      currentKey = keyValue[1];
      const value = keyValue[2].trim();
      metadata[currentKey] = value === "[]" ? [] : value || [];
      continue;
    }

    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(metadata[currentKey])) metadata[currentKey] = [];
      metadata[currentKey].push(listItem[1].trim());
    }
  }
  return metadata;
}

function isModelApiConfigured() {
  return Boolean(process.env.MODEL_API_KEY && process.env.MODEL_API_BASE_URL);
}

function normalizedBaseUrl() {
  return String(process.env.MODEL_API_BASE_URL).replace(/\/+$/, "");
}

function modelHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MODEL_API_KEY}`
  };
}

async function embedText(text) {
  if (!isModelApiConfigured() || process.env.MODEL_EMBEDDING_DISABLED === "true") {
    return fallbackEmbedding(text, dimensions);
  }

  try {
    const response = await fetch(`${normalizedBaseUrl()}/embeddings`, {
      method: "POST",
      headers: modelHeaders(),
      body: JSON.stringify({
        model: process.env.MODEL_EMBEDDING_MODEL ?? "text-embedding-v1",
        input: text
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const embedding = json.data?.[0]?.embedding;
    return Array.isArray(embedding) && embedding.length > 0 ? embedding : fallbackEmbedding(text, dimensions);
  } catch (error) {
    console.warn("Embedding API unavailable, using deterministic local embedding:", error);
    return fallbackEmbedding(text, dimensions);
  }
}

function fallbackEmbedding(text, size) {
  const vector = new Array(size).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const slot = (code + index * 31) % size;
    vector[slot] += ((code % 97) + 1) / 97;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function vectorLiteral(values) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

async function syncDocument(client, document) {
  const existing = await client.query(
    `select id
     from knowledge_documents
     where source_name = $1
     order by created_at desc
     limit 1`,
    [document.sourceName]
  );

  let documentId = existing.rows[0]?.id;
  if (documentId) {
    await client.query(
      `update knowledge_documents
       set title = $1, mime_type = $2, content = $3, metadata = $4::jsonb
       where id = $5`,
      [document.title, "text/markdown", document.content, JSON.stringify(document.metadata), documentId]
    );
    await client.query("delete from embeddings where document_id = $1", [documentId]);
  } else {
    const inserted = await client.query(
      `insert into knowledge_documents (title, source_name, mime_type, content, metadata)
       values ($1, $2, $3, $4, $5::jsonb)
       returning id`,
      [document.title, document.sourceName, "text/markdown", document.content, JSON.stringify(document.metadata)]
    );
    documentId = inserted.rows[0].id;
  }

  for (const [index, chunk] of document.chunks.entries()) {
    const embedding = await embedText(chunk);
    await client.query(
      `insert into embeddings (document_id, chunk_index, content, embedding, metadata)
       values ($1, $2, $3, $4::vector, $5::jsonb)`,
      [
        documentId,
        index,
        chunk,
        vectorLiteral(embedding),
        JSON.stringify({
          sourceName: document.sourceName,
          wikiPath: document.wikiPath,
          chunkIndex: index
        })
      ]
    );
  }

  return { title: document.title, sourceName: document.sourceName, chunks: document.chunks.length };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set; skipping PostgreSQL wiki sync.");
    return;
  }

  const files = (await listMarkdownFiles(wikiRoot)).filter((file) => path.basename(file).toLowerCase() !== "log.md");
  const documents = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(file, "utf8");
      const wikiPath = path.relative(wikiRoot, file).replace(/\\/g, "/");
      const metadata = parseFrontmatter(content);
      return {
        title: extractMarkdownTitle(content, path.basename(file, path.extname(file))),
        sourceName: `knowledge/wiki/${wikiPath}`,
        wikiPath,
        metadata,
        content,
        chunks: chunkText(content)
      };
    })
  );

  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `delete from knowledge_documents
       where source_name like 'knowledge/wiki/%'
         and not (source_name = any($1::text[]))`,
      [documents.map((document) => document.sourceName)]
    );

    const results = [];
    for (const document of documents) {
      results.push(await syncDocument(client, document));
    }
    await client.query("commit");
    console.log(
      JSON.stringify(
        {
          mode: "postgresql",
          documents: results.length,
          chunks: results.reduce((sum, item) => sum + item.chunks, 0),
          results
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
