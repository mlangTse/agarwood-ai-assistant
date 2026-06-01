import { embedText, fallbackEmbedding } from "@/lib/openai";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { KnowledgeChunk } from "@/lib/types";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type MatchKnowledgeRow = {
  id: string;
  document_id: string;
  title: string | null;
  content: string;
  similarity: number | null;
  metadata: Record<string, unknown> | null;
};

export type KnowledgeDocumentRecord = {
  id: string;
  title: string;
  sourceName?: string;
  mimeType?: string;
  content: string;
  chunks: KnowledgeChunk[];
  createdAt: string;
};

const RAG_TIMEOUT_MS = Number.parseInt(process.env.RAG_TIMEOUT_MS ?? "12000", 10);
const LOCAL_KNOWLEDGE_PATH = path.join(process.cwd(), "data", "knowledge-documents.json");

export function chunkText(text: string, chunkSize = 900, overlap = 140): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
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

export async function ingestKnowledgeDocument(input: {
  title: string;
  content: string;
  mimeType?: string;
  sourceName?: string;
}) {
  const supabase = await getSupabaseAdmin();
  const chunks = chunkText(input.content);
  const embeddings = await Promise.all(chunks.map((content) => embedText(content)));

  if (!supabase) {
    const document = await saveLocalKnowledgeDocument({
      title: input.title,
      sourceName: input.sourceName,
      mimeType: input.mimeType,
      content: input.content,
      chunks
    });

    return {
      documentId: document.id,
      chunks: chunks.length,
      mode: "local"
    };
  }

  const { data: doc, error: docError } = await supabase
    .from("knowledge_documents")
    .insert({
      title: input.title,
      source_name: input.sourceName,
      mime_type: input.mimeType,
      content: input.content
    })
    .select("id")
    .single();

  if (docError) throw docError;

  const rows = chunks.map((content, index) => ({
    document_id: doc.id,
    chunk_index: index,
    content,
    embedding: embeddings[index]
  }));

  const { error: embeddingError } = await supabase.from("embeddings").insert(rows);
  if (embeddingError) throw embeddingError;

  return { documentId: doc.id as string, chunks: rows.length, mode: "supabase" };
}

export async function retrieveKnowledge(question: string, matchCount = 5): Promise<KnowledgeChunk[]> {
  const supabase = await getSupabaseAdmin();

  if (!supabase) {
    return localKnowledgeSearch(question, matchCount);
  }

  const queryEmbedding = await embedText(question);
  const { data, error } = await withTimeout(
    supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      similarity_threshold: 0.2
    }),
    RAG_TIMEOUT_MS,
    "知识库检索超时"
  );

  if (error) throw error;
  return ((data ?? []) as MatchKnowledgeRow[]).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    title: row.title ?? "知识片段",
    content: row.content,
    similarity: row.similarity ?? undefined,
    metadata: row.metadata ?? undefined
  }));
}

export async function listKnowledgeDocuments() {
  const supabase = await getSupabaseAdmin();

  if (!supabase) {
    const documents = await readLocalKnowledgeDocuments();
    return {
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        sourceName: document.sourceName,
        mimeType: document.mimeType,
        chunks: document.chunks.length,
        createdAt: document.createdAt
      })),
      mode: "local"
    };
  }

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id,title,source_name,mime_type,created_at,embeddings(id)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return {
    documents: (data ?? []).map((document) => ({
      id: document.id as string,
      title: document.title as string,
      sourceName: document.source_name as string | undefined,
      mimeType: document.mime_type as string | undefined,
      chunks: Array.isArray(document.embeddings) ? document.embeddings.length : 0,
      createdAt: document.created_at as string
    })),
    mode: "supabase"
  };
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

async function localKnowledgeSearch(question: string, limit: number): Promise<KnowledgeChunk[]> {
  const documents = await readLocalKnowledgeDocuments();
  const uploadedChunks = documents.flatMap((document) =>
    document.chunks.map((chunk) => ({
      ...chunk,
      title: document.title,
      documentId: document.id,
      metadata: {
        sourceName: document.sourceName,
        createdAt: document.createdAt
      }
    }))
  );

  const seed: KnowledgeChunk[] = [
    {
      title: "星洲与惠安基础差异",
      content:
        "星洲系常以木质、凉感、穿透力和空间扩散见长；惠安系常以甜润、蜜韵、花香和细腻层次被讨论。具体仍需结合实物、结香状态和熏闻温度判断。"
    },
    {
      title: "奇楠说明",
      content:
        "奇楠通常指香气变化强、穿透力高、常带凉韵乳韵且质地特殊的一类高阶沉香。市场使用该词较复杂，必须结合来源、实物复闻与专业鉴别。"
    },
    {
      title: "沉水价格",
      content:
        "沉水代表密度达到可沉入水中的状态，常与油脂含量相关，但沉水不是价值的唯一条件。香气品质、产区、结香方式、稀缺性和来源记录都会影响价格。"
    },
    {
      title: "电熏与炭熏",
      content:
        "电熏控温稳定，适合新手和产区对比；炭熏仪式感强、变化丰富，但温度控制难，容易把甜韵烤焦或放大香材缺点。"
    }
  ];

  const candidates = uploadedChunks.length > 0 ? uploadedChunks : seed;
  const queryVector = fallbackEmbedding(question, 256);
  const queryTerms = tokenize(question);
  return candidates
    .map((chunk) => {
      const vector = fallbackEmbedding(chunk.content, 256);
      const keywordScore = keywordSimilarity(queryTerms, tokenize(`${chunk.title}\n${chunk.content}`));
      const vectorScore = cosineSimilarity(queryVector, vector);
      return { ...chunk, similarity: keywordScore * 0.7 + vectorScore * 0.3 };
    })
    .sort((a, b) => Number(b.similarity) - Number(a.similarity))
    .slice(0, limit);
}

async function saveLocalKnowledgeDocument(input: {
  title: string;
  sourceName?: string;
  mimeType?: string;
  content: string;
  chunks: string[];
}) {
  const documents = await readLocalKnowledgeDocuments();
  const id = crypto.randomUUID();
  const document: KnowledgeDocumentRecord = {
    id,
    title: input.title,
    sourceName: input.sourceName,
    mimeType: input.mimeType,
    content: input.content,
    createdAt: new Date().toISOString(),
    chunks: input.chunks.map((content, index) => ({
      id: `${id}-${index}`,
      documentId: id,
      title: input.title,
      content,
      metadata: {
        sourceName: input.sourceName,
        chunkIndex: index
      }
    }))
  };

  await writeLocalKnowledgeDocuments([document, ...documents]);
  return document;
}

async function readLocalKnowledgeDocuments(): Promise<KnowledgeDocumentRecord[]> {
  try {
    const content = await readFile(LOCAL_KNOWLEDGE_PATH, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeLocalKnowledgeDocuments(documents: KnowledgeDocumentRecord[]) {
  await mkdir(path.dirname(LOCAL_KNOWLEDGE_PATH), { recursive: true });
  await writeFile(LOCAL_KNOWLEDGE_PATH, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
}

function tokenize(text: string) {
  const terms = text
    .toLowerCase()
    .split(/[^\p{Script=Han}a-z0-9]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const chars = Array.from(text.replace(/\s/g, "")).filter((char) => /[\p{Script=Han}a-z0-9]/iu.test(char));
  return new Set([...terms, ...chars]);
}

function keywordSimilarity(queryTerms: Set<string>, contentTerms: Set<string>) {
  if (queryTerms.size === 0 || contentTerms.size === 0) return 0;
  let matches = 0;
  queryTerms.forEach((term) => {
    if (contentTerms.has(term)) matches += 1;
  });
  return matches / queryTerms.size;
}

function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / ((Math.sqrt(normA) || 1) * (Math.sqrt(normB) || 1));
}
