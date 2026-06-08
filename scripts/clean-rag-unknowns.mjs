import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const productPath = path.join(root, "data", "products.json");
const knowledgeDataPath = path.join(root, "data", "knowledge-documents.json");
const knowledgeSourcePath = path.join(root, "knowledge", "agarwood-products.md");

const unknownPatterns = [
  /unknown/i,
  /^n\/?a$/i,
  /^\?+$/,
  /^[\s\-_/]*$/,
  /^\u672a\u77e5$/,
  /^\u672a\u63d0\u4f9b$/,
  /^\u672a\u586b$/,
  /^\u672a\u586b\u5199$/,
  /^\u672a\u6807\u6ce8(?:\u4ea7\u533a)?$/,
  /^\u5f85\u8865\u5145$/,
  /^\u5f85\u8be2\u4ef7$/,
  /^\u6682\u65e0$/,
  /^\u65e0$/
];

const fieldWithUnknownValuePattern =
  /^(\s*[-*]?\s*[^:\uff1a]+[:\uff1a]\s*)(?:unknown|n\/?a|\?+|\u672a\u77e5|\u672a\u63d0\u4f9b|\u672a\u586b(?:\u5199)?|\u672a\u6807\u6ce8(?:\u4ea7\u533a)?|\u5f85\u8865\u5145|\u5f85\u8be2\u4ef7|\u6682\u65e0|\u65e0)\s*$/i;

const aromaScoreKeys = [
  "sweetness",
  "coolness",
  "creaminess",
  "medicinal",
  "woody",
  "penetration",
  "longevity",
  "beginnerFriendly",
  "collectionValue"
];

function isUnknownValue(value) {
  if (value === undefined || value === null) return true;
  const text = String(value).trim();
  return unknownPatterns.some((pattern) => pattern.test(text));
}

function sanitizeTextValue(value) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (isUnknownValue(text)) return "";
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isUnknownValue(line))
    .join("\n");
}

function sanitizeStringList(values) {
  return values.map((value) => sanitizeTextValue(value)).filter(Boolean);
}

function sanitizeKnowledgeText(content) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (isUnknownValue(trimmed)) return false;
      return !fieldWithUnknownValuePattern.test(trimmed);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function normalizeScore(value, fallback = 60) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function inferRegion(product) {
  const value = [product.name, product.description, ...(product.scentTags ?? [])].join(" ");
  if (value.includes("海南")) return "海南";
  if (value.includes("惠安")) return "惠安系";
  if (value.includes("星洲") || value.includes("加里曼丹")) return "星洲系";
  if (value.includes("芽庄")) return "芽庄";
  if (value.includes("达拉干")) return "达拉干";
  if (value.includes("柬埔寨")) return "柬埔寨";
  if (value.includes("马泥涝")) return "马泥涝";
  if (value.includes("奇楠")) return "奇楠";
  if (["包装", "香炉", "炉", "香盒", "盒", "葫芦", "香刀"].some((item) => value.includes(item))) return "配套用品";
  if (["茶", "精油", "烟丝"].some((item) => value.includes(item))) return "沉香制品";
  return "";
}

async function cleanProducts() {
  let products;
  try {
    products = JSON.parse(await readFile(productPath, "utf8"));
  } catch {
    return { read: 0, kept: 0, removed: 0 };
  }
  if (!Array.isArray(products)) return { read: 0, kept: 0, removed: 0 };

  const cleaned = [];
  for (const product of products) {
    const name = sanitizeTextValue(product.name);
    const description = sanitizeTextValue(product.description);
    const scentTags = sanitizeStringList(product.scentTags ?? []);
    const candidate = { ...product, name, description, scentTags };
    const region = sanitizeTextValue(product.region) || inferRegion(candidate);
    if (!name || !region) continue;

    cleaned.push({
      ...product,
      name,
      region,
      description,
      riskNotes: sanitizeStringList(product.riskNotes ?? []),
      suitableFor: sanitizeStringList(product.suitableFor ?? []),
      scentTags,
      aromaScores: Object.fromEntries(
        aromaScoreKeys.map((key) => [key, normalizeScore(product.aromaScores?.[key], key === "collectionValue" ? 40 : 60)])
      )
    });
  }

  await mkdir(path.dirname(productPath), { recursive: true });
  await writeFile(productPath, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");
  return { read: products.length, kept: cleaned.length, removed: products.length - cleaned.length };
}

async function cleanKnowledgeSource() {
  try {
    const content = await readFile(knowledgeSourcePath, "utf8");
    const cleaned = sanitizeKnowledgeText(content);
    await writeFile(knowledgeSourcePath, `${cleaned}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function cleanKnowledgeData() {
  let documents;
  try {
    documents = JSON.parse(await readFile(knowledgeDataPath, "utf8"));
  } catch {
    return { read: 0, kept: 0, removed: 0 };
  }
  if (!Array.isArray(documents)) return { read: 0, kept: 0, removed: 0 };

  const cleaned = [];
  for (const document of documents) {
    const content = sanitizeKnowledgeText(document.content ?? "");
    if (!content) continue;
    const chunks = chunkText(content).map((chunk, index) => ({
      id: `${document.id}-${index}`,
      documentId: document.id,
      title: document.title,
      content: chunk,
      metadata: {
        sourceName: document.sourceName,
        chunkIndex: index
      }
    }));
    cleaned.push({ ...document, content, chunks });
  }

  await mkdir(path.dirname(knowledgeDataPath), { recursive: true });
  await writeFile(knowledgeDataPath, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");
  return { read: documents.length, kept: cleaned.length, removed: documents.length - cleaned.length };
}

const productResult = await cleanProducts();
const sourceUpdated = await cleanKnowledgeSource();
const knowledgeResult = await cleanKnowledgeData();

console.log(JSON.stringify({ products: productResult, knowledgeSourceUpdated: sourceUpdated, knowledge: knowledgeResult }, null, 2));
