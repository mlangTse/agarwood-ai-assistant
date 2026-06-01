import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sampleProducts } from "@/lib/sample-data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AromaScoreKey, AromaScores, BudgetLevel, Product, ProductType } from "@/lib/types";

export type ProductImportResult = {
  createdCount: number;
  skippedCount: number;
  products: Product[];
  errors: string[];
  mode: "local" | "supabase";
};

const LOCAL_PRODUCTS_PATH = path.join(process.cwd(), "data", "products.json");

const aromaScoreKeys: AromaScoreKey[] = [
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

const defaultAromaScores: AromaScores = {
  sweetness: 60,
  coolness: 60,
  creaminess: 60,
  medicinal: 60,
  woody: 60,
  penetration: 60,
  longevity: 60,
  beginnerFriendly: 60,
  collectionValue: 40
};

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(["wood", "bracelet", "powder", "incense", "object", "investment"]),
  region: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  budgetLevel: z.enum(["500", "3000", "20000", "collector"]),
  description: z.string().default(""),
  riskNotes: z.array(z.string()).default([]),
  suitableFor: z.array(z.string()).default([]),
  scentTags: z.array(z.string()).default([]),
  aromaScores: z.record(z.number()).transform((scores) => normalizeAromaScores(scores)),
  inventoryStatus: z.enum(["in_stock", "limited", "archived"]).default("in_stock")
});

type ProductInput = z.input<typeof productSchema>;

type SupabaseProductRow = {
  id: string;
  name: string;
  product_type: ProductType;
  region: string;
  price_cents: number;
  budget_level: BudgetLevel;
  description: string;
  risk_notes: string[] | null;
  suitable_for: string[] | null;
  scent_tags: string[] | null;
  aroma_scores: Partial<AromaScores> | null;
  inventory_status: Product["inventoryStatus"];
};

export function validateProductInput(input: ProductInput): Omit<Product, "id"> {
  const product = productSchema.parse(input);
  return {
    name: product.name,
    type: product.type,
    region: product.region,
    priceCents: product.priceCents,
    budgetLevel: product.budgetLevel,
    description: product.description,
    riskNotes: product.riskNotes,
    suitableFor: product.suitableFor,
    scentTags: product.scentTags,
    aromaScores: product.aromaScores,
    inventoryStatus: product.inventoryStatus
  };
}

export async function listProducts(): Promise<{ products: Product[]; mode: "local" | "supabase" }> {
  const supabase = await getSupabaseAdmin();
  if (!supabase) return { products: await readLocalProducts(), mode: "local" };

  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;

  return {
    products: ((data ?? []) as SupabaseProductRow[]).map(mapSupabaseProduct),
    mode: "supabase"
  };
}

export async function createProduct(input: ProductInput): Promise<{ product: Product; mode: "local" | "supabase" }> {
  const payload = validateProductInput(input);
  const supabase = await getSupabaseAdmin();

  if (!supabase) {
    const products = await readLocalProducts();
    const product: Product = { id: crypto.randomUUID(), ...payload };
    await writeLocalProducts([product, ...products]);
    return { product, mode: "local" };
  }

  const { data, error } = await supabase
    .from("products")
    .insert(toSupabaseProductInsert(payload))
    .select("*")
    .single();

  if (error) throw error;
  return { product: mapSupabaseProduct(data as SupabaseProductRow), mode: "supabase" };
}

export async function importProducts(inputs: ProductInput[]): Promise<ProductImportResult> {
  const supabase = await getSupabaseAdmin();
  const current = supabase ? (await listProducts()).products : await readLocalProducts();
  const existingKeys = new Set(current.map(productKey));
  const products: Product[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  for (const [index, input] of inputs.entries()) {
    try {
      const payload = validateProductInput(input);
      const candidate: Product = { id: crypto.randomUUID(), ...payload };
      const key = productKey(candidate);
      if (existingKeys.has(key)) {
        skippedCount += 1;
        continue;
      }
      existingKeys.add(key);
      products.push(candidate);
    } catch (error) {
      errors.push(`第 ${index + 1} 条：${error instanceof Error ? error.message : "商品格式不正确"}`);
    }
  }

  if (products.length === 0) {
    return {
      createdCount: 0,
      skippedCount,
      products: [],
      errors,
      mode: supabase ? "supabase" : "local"
    };
  }

  if (!supabase) {
    await writeLocalProducts([...products, ...current]);
    return {
      createdCount: products.length,
      skippedCount,
      products,
      errors,
      mode: "local"
    };
  }

  const { data, error } = await supabase
    .from("products")
    .insert(products.map(({ id: _id, ...product }) => toSupabaseProductInsert(product)))
    .select("*");

  if (error) throw error;

  return {
    createdCount: products.length,
    skippedCount,
    products: ((data ?? []) as SupabaseProductRow[]).map(mapSupabaseProduct),
    errors,
    mode: "supabase"
  };
}

export function parseProductRows(rows: Record<string, unknown>[]): ProductInput[] {
  return rows.map((row) => normalizeImportRow(row)).filter((row): row is ProductInput => Boolean(row.name));
}

export function parseProductText(content: string): ProductInput[] {
  const tableRows = parseMarkdownTables(content);
  if (tableRows.length > 0) return parseProductRows(tableRows);
  return parseProductRows(parseFieldBlocks(content));
}

function mapSupabaseProduct(row: SupabaseProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    type: row.product_type,
    region: row.region,
    priceCents: row.price_cents,
    budgetLevel: row.budget_level,
    description: row.description ?? "",
    riskNotes: row.risk_notes ?? [],
    suitableFor: row.suitable_for ?? [],
    scentTags: row.scent_tags ?? [],
    aromaScores: normalizeAromaScores(row.aroma_scores ?? {}),
    inventoryStatus: row.inventory_status ?? "in_stock"
  };
}

function toSupabaseProductInsert(product: Omit<Product, "id">) {
  return {
    name: product.name,
    product_type: product.type,
    region: product.region,
    price_cents: product.priceCents,
    budget_level: product.budgetLevel,
    description: product.description,
    risk_notes: product.riskNotes,
    suitable_for: product.suitableFor,
    scent_tags: product.scentTags,
    aroma_scores: product.aromaScores,
    inventory_status: product.inventoryStatus
  };
}

async function readLocalProducts(): Promise<Product[]> {
  try {
    const content = await readFile(LOCAL_PRODUCTS_PATH, "utf8");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [...sampleProducts];
    return parsed.map((item) => ({ id: item.id ?? crypto.randomUUID(), ...validateProductInput(item) }));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await writeLocalProducts(sampleProducts);
      return [...sampleProducts];
    }
    throw error;
  }
}

async function writeLocalProducts(products: Product[]) {
  await mkdir(path.dirname(LOCAL_PRODUCTS_PATH), { recursive: true });
  await writeFile(LOCAL_PRODUCTS_PATH, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}

function normalizeImportRow(row: Record<string, unknown>): ProductInput {
  const value = (aliases: string[], fallback = "") => String(readAlias(row, aliases) ?? fallback).trim();
  const name = value(["name", "商品名称", "名称", "产品名称", "标题", "title"]);
  const tags = splitList(value(["scentTags", "香韵标签", "香韵/场景标签", "标签", "场景标签"]));
  const descriptionParts = [
    value(["description", "商品描述", "产品介绍", "介绍"]),
    value(["功效味道及用途", "用途"]),
    value(["规格/单位", "规格"]),
    value(["货号", "sku", "SKU"])
  ].filter(Boolean);

  return {
    name,
    type: normalizeProductType(value(["type", "productType", "产品类型", "类型"], inferTypeFromTags(tags))),
    region: value(["region", "产区", "来源", "地区"], inferRegion([...tags, name].join(" "))),
    priceCents: normalizePrice(readAlias(row, ["priceCents", "price_cents", "价格分"]), value(["priceYuan", "price", "零售价", "售价", "价格"])),
    budgetLevel: normalizeBudget(value(["budgetLevel", "budget_level", "预算层级", "预算"], "")),
    description: descriptionParts.join("\n"),
    riskNotes: splitList(value(["riskNotes", "risk_notes", "风险提示", "风险点"])),
    suitableFor: splitList(value(["suitableFor", "suitable_for", "适合场景", "适合人群", "场景"])),
    scentTags: tags,
    aromaScores: Object.fromEntries(aromaScoreKeys.map((key) => [key, normalizeScore(readAlias(row, scoreAliases(key)))])),
    inventoryStatus: normalizeInventoryStatus(value(["inventoryStatus", "inventory_status", "库存状态"], "in_stock"))
  };
}

function parseMarkdownTables(content: string) {
  const rows: Record<string, string>[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes("|") || !/^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) continue;
    const headers = splitTableLine(lines[index]);
    index += 2;
    while (index < lines.length && lines[index].includes("|")) {
      const values = splitTableLine(lines[index]);
      if (values.length === headers.length) {
        rows.push(Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""])));
      }
      index += 1;
    }
  }
  return rows;
}

function parseFieldBlocks(content: string) {
  const rows: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const heading = rawLine.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) {
      if (current && current.name) rows.push(current);
      current = { name: heading[1].trim() };
      continue;
    }

    const field = rawLine.match(/^\s*[-*]?\s*([^：:]+)[：:]\s*(.+?)\s*$/);
    if (field && current) {
      current[field[1].trim()] = field[2].trim();
    }
  }

  if (current && current.name) rows.push(current);
  return rows;
}

function splitTableLine(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function readAlias(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return row[alias];
    }
  }
  return undefined;
}

function splitList(value: string) {
  return value
    .split(/[,，、;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeProductType(value: string): ProductType {
  if (["bracelet", "手串", "首饰"].some((item) => value.includes(item))) return "bracelet";
  if (["powder", "香粉", "粉"].some((item) => value.includes(item))) return "powder";
  if (["incense", "线香", "方条香", "香"].some((item) => value.includes(item))) return "incense";
  if (["object", "摆件", "器物"].some((item) => value.includes(item))) return "object";
  if (["investment", "收藏", "奇楠级"].some((item) => value.includes(item))) return "investment";
  return "wood";
}

function inferTypeFromTags(tags: string[]) {
  return tags.join(" ");
}

function inferRegion(value: string) {
  if (value.includes("海南")) return "海南";
  if (value.includes("惠安")) return "惠安系";
  if (value.includes("星洲") || value.includes("加里曼丹")) return "星洲系";
  if (value.includes("芽庄")) return "芽庄";
  if (value.includes("达拉干")) return "达拉干";
  return "未标注产区";
}

function normalizePrice(priceCents: unknown, priceYuan: string) {
  const cents = Number(priceCents);
  if (Number.isFinite(cents) && cents > 0) return Math.round(cents);
  const yuan = Number(priceYuan.replace(/[^\d.]/g, ""));
  return Number.isFinite(yuan) ? Math.round(yuan * 100) : 0;
}

function normalizeBudget(value: string): BudgetLevel {
  if (value.includes("收藏") || value.toLowerCase() === "collector") return "collector";
  if (value.includes("20000") || value.includes("2 万") || value.includes("2万")) return "20000";
  if (value.includes("3000") || value.includes("进阶")) return "3000";
  return "500";
}

function normalizeInventoryStatus(value: string): Product["inventoryStatus"] {
  if (value === "limited" || value.includes("少") || value.includes("限")) return "limited";
  if (value === "archived" || value.includes("下架") || value.includes("归档")) return "archived";
  return "in_stock";
}

function normalizeScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 60;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeAromaScores(scores: Partial<Record<string, unknown>>): AromaScores {
  return Object.fromEntries(aromaScoreKeys.map((key) => [key, normalizeScore(scores[key])])) as AromaScores;
}

function scoreAliases(key: AromaScoreKey) {
  const aliases: Record<AromaScoreKey, string[]> = {
    sweetness: ["sweetness", "甜感"],
    coolness: ["coolness", "凉感"],
    creaminess: ["creaminess", "奶韵"],
    medicinal: ["medicinal", "药感"],
    woody: ["woody", "木质感"],
    penetration: ["penetration", "穿透力"],
    longevity: ["longevity", "留香"],
    beginnerFriendly: ["beginnerFriendly", "beginner_friendly", "新手友好度"],
    collectionValue: ["collectionValue", "collection_value", "收藏价值"]
  };
  return aliases[key];
}

function productKey(product: Pick<Product, "name" | "region" | "type">) {
  return `${product.name.trim().toLowerCase()}|${product.region.trim().toLowerCase()}|${product.type}`;
}
