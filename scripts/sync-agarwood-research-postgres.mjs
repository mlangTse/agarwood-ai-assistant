import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const root = process.cwd();
const sourceName = "agarwood-regions-research.md";
const title = "沉香产区、种植与野生资料库";
const sourcePath = path.join(root, "knowledge", sourceName);

async function loadEnvFile(fileName) {
  try {
    const content = await readFile(path.join(root, fileName), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional env file.
  }
}

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

function fallbackEmbedding(text, dimensions = 1536) {
  const vector = new Array(dimensions).fill(0);
  for (const [index, char] of Array.from(text).entries()) {
    const code = char.codePointAt(0) ?? 0;
    const slot = (code + index * 31) % dimensions;
    vector[slot] += ((code % 97) + 1) / 97;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function vectorLiteral(values) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

await loadEnvFile(".env.local");
await loadEnvFile(".env.production");
await loadEnvFile(".env");

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ mode: "skipped", reason: "DATABASE_URL not set" }));
  process.exit(0);
}

const content = await readFile(sourcePath, "utf8");
const chunks = chunkText(content);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

const client = await pool.connect();
try {
  await client.query("begin");
  const existing = await client.query(
    `select id
     from knowledge_documents
     where source_name = $1 or title = $2
     order by created_at desc
     limit 1`,
    [sourceName, title]
  );

  let documentId = existing.rows[0]?.id;
  if (documentId) {
    await client.query(
      `update knowledge_documents
       set title = $1, source_name = $2, mime_type = $3, content = $4, metadata = $5::jsonb
       where id = $6`,
      [
        title,
        sourceName,
        "text/markdown",
        content,
        JSON.stringify({ syncedBy: "scripts/sync-agarwood-research-postgres.mjs", syncedAt: new Date().toISOString() }),
        documentId
      ]
    );
    await client.query("delete from embeddings where document_id = $1", [documentId]);
  } else {
    const inserted = await client.query(
      `insert into knowledge_documents (title, source_name, mime_type, content, metadata)
       values ($1, $2, $3, $4, $5::jsonb)
       returning id`,
      [
        title,
        sourceName,
        "text/markdown",
        content,
        JSON.stringify({ syncedBy: "scripts/sync-agarwood-research-postgres.mjs", syncedAt: new Date().toISOString() })
      ]
    );
    documentId = inserted.rows[0].id;
  }

  for (const [index, chunk] of chunks.entries()) {
    await client.query(
      `insert into embeddings (document_id, chunk_index, content, embedding, metadata)
       values ($1, $2, $3, $4::vector, $5::jsonb)`,
      [
        documentId,
        index,
        chunk,
        vectorLiteral(fallbackEmbedding(chunk)),
        JSON.stringify({ sourceName, chunkIndex: index, embeddingMode: "deterministic-local" })
      ]
    );
  }

  await client.query("commit");
  console.log(JSON.stringify({ mode: "postgresql", documentId, chunks: chunks.length }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
