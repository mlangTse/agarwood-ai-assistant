import { getDatabase, vectorLiteral } from "@/lib/db";
import { embedText, fallbackEmbedding } from "@/lib/model-api";
import { sanitizeKnowledgeText } from "@/lib/sanitize";
import type { KnowledgeChunk } from "@/lib/types";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
const LOCAL_WIKI_PATH = path.join(process.cwd(), "knowledge", "wiki");

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
  const db = await getDatabase();
  const content = sanitizeKnowledgeText(input.content);
  const chunks = chunkText(content);
  const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk)));

  if (!db) {
    const document = await saveLocalKnowledgeDocument({
      title: input.title,
      sourceName: input.sourceName,
      mimeType: input.mimeType,
      content,
      chunks
    });

    return {
      documentId: document.id,
      chunks: chunks.length,
      mode: "local"
    };
  }

  const documentId = await db.transaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `select id
       from knowledge_documents
       where ($1::text is not null and source_name = $1) or title = $2
       order by created_at desc
       limit 1`,
      [input.sourceName ?? null, input.title]
    );

    let documentId = existing.rows[0]?.id;
    if (documentId) {
      await client.query(
        `update knowledge_documents
         set title = $1, source_name = $2, mime_type = $3, content = $4
         where id = $5`,
        [input.title, input.sourceName, input.mimeType, content, documentId]
      );
      await client.query("delete from embeddings where document_id = $1", [documentId]);
    } else {
      const inserted = await client.query<{ id: string }>(
        `insert into knowledge_documents (title, source_name, mime_type, content)
         values ($1, $2, $3, $4)
         returning id`,
        [input.title, input.sourceName, input.mimeType, content]
      );
      documentId = inserted.rows[0].id;
    }

    for (const [index, chunk] of chunks.entries()) {
      await client.query(
        `insert into embeddings (document_id, chunk_index, content, embedding)
         values ($1, $2, $3, $4::vector)`,
        [documentId, index, chunk, vectorLiteral(embeddings[index])]
      );
    }

    return documentId;
  });

  return { documentId, chunks: chunks.length, mode: "postgresql" };
}

export async function retrieveKnowledge(question: string, matchCount = 5): Promise<KnowledgeChunk[]> {
  const db = await getDatabase();
  const normalizedQuestion = normalizeKnowledgeQuestion(question);

  if (!db) {
    return localKnowledgeSearch(normalizedQuestion, matchCount);
  }

  const queryEmbedding = await embedText(normalizedQuestion);
  const keywordTerms = buildSearchTerms(normalizedQuestion);
  const keywordPatterns = keywordTerms.map((term) => `%${escapeLike(term)}%`);

  const { rows } = await withTimeout(
    db.query<MatchKnowledgeRow>(
      `with vector_matches as (
        select
          e.id,
          e.document_id,
          d.title,
          e.content,
          e.metadata,
          1 - (e.embedding <=> $1::vector) as similarity,
          0 as keyword_score,
          case
            when d.source_name like 'knowledge/wiki/concepts/%' then 0.45
            when d.source_name like 'knowledge/wiki/entities/%' then 0.30
            when d.source_name like 'knowledge/wiki/sources/%' then -0.20
            else 0
          end as page_score
        from embeddings e
        join knowledge_documents d on d.id = e.document_id
        where d.source_name like 'knowledge/wiki/%'
        order by e.embedding <=> $1::vector
        limit $4
      ),
      keyword_matches as (
        select
          e.id,
          e.document_id,
          d.title,
          e.content,
          e.metadata,
          null::double precision as similarity,
          (
            select count(*)
            from unnest($3::text[]) term
            where e.content ilike term escape '\\' or d.title ilike term escape '\\'
          ) as keyword_score,
          case
            when d.source_name like 'knowledge/wiki/concepts/%' then 0.45
            when d.source_name like 'knowledge/wiki/entities/%' then 0.30
            when d.source_name like 'knowledge/wiki/sources/%' then -0.20
            else 0
          end as page_score
        from embeddings e
        join knowledge_documents d on d.id = e.document_id
        where cardinality($3::text[]) > 0
          and d.source_name like 'knowledge/wiki/%'
          and exists (
            select 1
            from unnest($3::text[]) term
            where e.content ilike term escape '\\' or d.title ilike term escape '\\'
          )
        order by keyword_score desc, e.created_at desc
        limit $4
      )
      select
        id,
        document_id,
        title,
        content,
        metadata,
        similarity
      from (
        select
          *,
          row_number() over (partition by id order by rank_score desc) as duplicate_rank
        from (
          select *, coalesce(similarity, 0) + keyword_score * 0.10 + page_score as rank_score
          from vector_matches
          union all
          select *, coalesce(similarity, 0) + keyword_score * 0.10 + page_score as rank_score
          from keyword_matches
        ) ranked
      ) deduped
      where duplicate_rank = 1
      order by rank_score desc
      limit $2`,
      [vectorLiteral(queryEmbedding), matchCount, keywordPatterns, Math.max(matchCount * 4, 24)]
    ),
    RAG_TIMEOUT_MS,
    "知识库检索超时"
  );

  return rows.slice(0, matchCount).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    title: row.title ?? "知识片段",
    content: row.content,
    similarity: row.similarity ?? undefined,
    metadata: row.metadata ?? undefined
  }));
}

export async function listKnowledgeDocuments() {
  const db = await getDatabase();

  if (!db) {
    const wikiDocuments = await readWikiKnowledgeDocuments();
    return {
      documents: wikiDocuments.map((document) => ({
        id: document.id,
        title: document.title,
        sourceName: document.sourceName,
        mimeType: document.mimeType,
        chunks: document.chunks.length,
        createdAt: document.createdAt,
        readOnly: document.id.startsWith("wiki:")
      })),
      mode: "local+wiki"
    };
  }

  const { rows } = await db.query<{
    id: string;
    title: string;
    source_name: string | null;
    mime_type: string | null;
    created_at: string;
    chunks: string;
  }>(
    `select
      d.id,
      d.title,
      d.source_name,
      d.mime_type,
      d.created_at,
      count(e.id)::int as chunks
     from knowledge_documents d
     left join embeddings e on e.document_id = d.id
     where d.source_name like 'knowledge/wiki/%'
     group by d.id
     order by d.created_at desc`
  );

  return {
    documents: rows.map((document) => ({
      id: document.id,
      title: document.title,
      sourceName: document.source_name ?? undefined,
      mimeType: document.mime_type ?? undefined,
      chunks: Number(document.chunks),
      createdAt: document.created_at,
      readOnly: document.source_name?.startsWith("knowledge/wiki/") ?? false
    })),
    mode: "postgresql"
  };
}

export async function deleteKnowledgeDocument(id: string) {
  const db = await getDatabase();

  if (!db) {
    if (id.startsWith("wiki:")) {
      throw new Error("Wiki 页面由 knowledge/wiki 管理，不能从 RAG 后台删除。");
    }

    const documents = await readLocalKnowledgeDocuments();
    const nextDocuments = documents.filter((document) => document.id !== id);
    if (nextDocuments.length === documents.length) {
      throw new Error("未找到要删除的知识库资料。");
    }
    await writeLocalKnowledgeDocuments(nextDocuments);
    return { deletedId: id, mode: "local" as const };
  }

  const { rows } = await db.query<{ id: string }>(
    `delete from knowledge_documents
     where id = $1
       and coalesce(source_name, '') not like 'knowledge/wiki/%'
     returning id`,
    [id]
  );

  if (!rows[0]) {
    throw new Error("未找到可删除的知识库资料，或该资料由 LLM Wiki 自动维护。");
  }

  return { deletedId: rows[0].id, mode: "postgresql" as const };
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
  const wikiDocuments = await readWikiKnowledgeDocuments();
  const uploadedChunks = wikiDocuments.flatMap((document) =>
    document.chunks.map((chunk) => ({
      ...chunk,
      title: document.title,
      documentId: document.id,
      metadata: {
        ...chunk.metadata,
        sourceName: document.sourceName,
        createdAt: document.createdAt
      }
    }))
  );

  if (uploadedChunks.length === 0) return [];

  const queryVector = fallbackEmbedding(question, 256);
  const queryTerms = tokenize(question);
  return uploadedChunks
    .map((chunk) => {
      const vector = fallbackEmbedding(chunk.content, 256);
      const keywordScore = keywordSimilarity(queryTerms, tokenize(`${chunk.title}\n${chunk.content}`));
      const vectorScore = cosineSimilarity(queryVector, vector);
      const pageScore = pagePriorityScore(chunk);
      const titleBoost = titleIntentBoost(question, chunk);
      return { ...chunk, similarity: keywordScore * 0.7 + vectorScore * 0.3 + pageScore + titleBoost };
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
  const existing = documents.find(
    (item) => item.title === input.title || (input.sourceName && item.sourceName === input.sourceName)
  );
  const id = existing?.id ?? crypto.randomUUID();
  const document: KnowledgeDocumentRecord = {
    id,
    title: input.title,
    sourceName: input.sourceName,
    mimeType: input.mimeType,
    content: input.content,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
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

  const filtered = documents.filter(
    (item) => item.title !== input.title && (!input.sourceName || item.sourceName !== input.sourceName)
  );
  await writeLocalKnowledgeDocuments([document, ...filtered]);
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

async function readWikiKnowledgeDocuments(): Promise<KnowledgeDocumentRecord[]> {
  const files = await listMarkdownFiles(LOCAL_WIKI_PATH);

  const documents = await Promise.all(
    files
      .filter((file) => path.basename(file).toLowerCase() !== "log.md")
      .map(async (file) => {
        const content = await readFile(file, "utf8");
        const relativePath = path.relative(LOCAL_WIKI_PATH, file).replace(/\\/g, "/");
        const title = extractMarkdownTitle(content) ?? path.basename(file, path.extname(file));
        const chunks = chunkText(content);
        const id = `wiki:${relativePath}`;
        const pageType = wikiPageType(relativePath);

        return {
          id,
          title,
          sourceName: `knowledge/wiki/${relativePath}`,
          mimeType: "text/markdown",
          content,
          createdAt: "2026-06-11T00:00:00.000Z",
          chunks: chunks.map((chunk, index) => ({
            id: `${id}#${index}`,
            documentId: id,
            title,
            content: chunk,
            metadata: {
              sourceName: `knowledge/wiki/${relativePath}`,
              chunkIndex: index,
              wikiPath: relativePath,
              pageType
            }
          }))
        } satisfies KnowledgeDocumentRecord;
      })
  );

  return documents;
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  try {
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
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function extractMarkdownTitle(content: string) {
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const match = withoutFrontmatter.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

async function writeLocalKnowledgeDocuments(documents: KnowledgeDocumentRecord[]) {
  await mkdir(path.dirname(LOCAL_KNOWLEDGE_PATH), { recursive: true });
  await writeFile(LOCAL_KNOWLEDGE_PATH, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
}

function buildSearchTerms(text: string) {
  const expanded = expandQuery(normalizeKnowledgeQuestion(text));
  return Array.from(tokenize(expanded))
    .filter((term) => term.length >= 2)
    .slice(0, 32);
}

function expandQuery(text: string) {
  const expansions: string[] = [text];
  if (/产区|地区|对比|比较|区别|莞香|惠安|星洲/.test(text)) {
    expansions.push("产区对比 产区 地区 莞香 中国系 惠安系 星洲系 海南 广东 电白 茂名 越南 芽庄 印尼 马来西亚 达拉干 马泥涝 Aquilaria Gyrinops");
  }
  if (/种植|野生|人工/.test(text)) {
    expansions.push("人工种植沉香 野生沉香 诱导结香 来源证明 合规 结香");
  }
  if (/奇楠/.test(text)) {
    expansions.push("奇楠 凉韵 奶韵 蜜韵 高阶沉香 真假鉴别 价格等级");
  }
  if (/沉水|半沉|浮水/.test(text)) {
    expansions.push("沉水 半沉 浮水 油脂 密度 价格等级 真假鉴别");
  }
  if (/香韵|香气|清甜|凉意|奶韵|药感|木质|花蜜|清雅/.test(text)) {
    expansions.push("香韵解释 闻香体验 清甜 凉意 奶韵 药感 木质 花蜜 清雅 气味强度");
  }
  if (/茶室|书房|静坐|助眠|商务空间|送礼|自用|用途|使用场景/.test(text)) {
    expansions.push("闻香场景 茶室 书房 静坐 助眠 商务空间 送礼 自用 收藏");
  }
  if (/电熏|隔火|线香|随身闻香|熏闻|保养|工艺|佩戴|盘玩/.test(text)) {
    expansions.push("熏闻方式 工艺保养 电熏 隔火 线香 随身闻香 手串 香材 香粉");
  }
  if (/真假|鉴别|真伪|检测|来源记录|合法来源|风险边界/.test(text)) {
    expansions.push("真假鉴别 鉴别风险 检测佐证 来源记录 合法来源 风险边界 合规表达");
  }
  if (/价格|等级|预算|500|3000|20000|收藏级|入门|进阶|高阶/.test(text)) {
    expansions.push("价格等级 预算层级 产品形态 购买偏好 入门试香 进阶预算 高阶预算 收藏级");
  }
  if (/香材|手串|香粉|摆件|收藏藏品|产品类型|产品形态/.test(text)) {
    expansions.push("产品形态 香材 手串 香粉 线香 摆件 收藏藏品");
  }
  return expansions.join(" ");
}

function normalizeKnowledgeQuestion(text: string) {
  const selectedTopic = text.match(/主题[：:]\s*([^；;\n]+)/)?.[1]?.trim();
  if (selectedTopic) return `${selectedTopic} ${text}`;

  const selectedPreference = text.match(/偏好[：:]\s*([^；;\n]+)/)?.[1]?.trim();
  if (selectedPreference) return `${selectedPreference} ${text}`;

  return text;
}

function wikiPageType(relativePath: string) {
  if (relativePath.startsWith("concepts/")) return "concept";
  if (relativePath.startsWith("entities/")) return "entity";
  if (relativePath.startsWith("sources/")) return "source";
  return "wiki";
}

function pagePriorityScore(chunk: KnowledgeChunk) {
  const sourceName = typeof chunk.metadata?.sourceName === "string" ? chunk.metadata.sourceName : "";
  const wikiPath = typeof chunk.metadata?.wikiPath === "string" ? chunk.metadata.wikiPath : "";
  const pathText = `${sourceName}\n${wikiPath}`;
  if (/knowledge\/wiki\/concepts\//.test(pathText) || /^concepts\//.test(pathText)) return 0.45;
  if (/knowledge\/wiki\/entities\//.test(pathText) || /^entities\//.test(pathText)) return 0.3;
  if (/knowledge\/wiki\/sources\//.test(pathText) || /^sources\//.test(pathText)) return -0.2;
  return 0;
}

function titleIntentBoost(question: string, chunk: KnowledgeChunk) {
  const normalized = normalizeKnowledgeQuestion(question);
  const title = chunk.title;
  const topicTitles = ["产区对比", "香韵解释", "真假鉴别", "价格等级", "工艺保养"];
  return topicTitles.some((topic) => normalized.includes(topic) && title.includes(topic)) ? 0.8 : 0;
}

function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
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
