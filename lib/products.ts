import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { sampleProducts } from "@/lib/sample-data";
import { sanitizeStringList, sanitizeTextValue } from "@/lib/sanitize";
import type { AromaScoreKey, AromaScores, BudgetLevel, Product, ProductType } from "@/lib/types";

export type ProductImportResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  products: Product[];
  errors: string[];
  mode: "local" | "postgresql";
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
  region: z.string().default(""),
  priceCents: z.number().int().nonnegative(),
  budgetLevel: z.enum(["500", "3000", "20000", "collector"]),
  description: z.string().default(""),
  riskNotes: z.array(z.string()).default([]),
  suitableFor: z.array(z.string()).default([]),
  scentTags: z.array(z.string()).default([]),
  aromaScores: z.record(z.number()).default({}).transform((scores) => normalizeAromaScores(scores)),
  inventoryStatus: z.enum(["in_stock", "limited", "archived"]).default("in_stock")
});

type ProductInput = z.input<typeof productSchema>;
type ProductPatchInput = Partial<ProductInput>;

type ProductRow = {
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
  const name = sanitizeTextValue(product.name);
  const region = sanitizeTextValue(product.region) || "未标注产区";
  if (!name) throw new Error("商品名称不能为空。");

  return {
    name,
    type: product.type,
    region,
    priceCents: product.priceCents,
    budgetLevel: product.budgetLevel,
    description: sanitizeTextValue(product.description),
    riskNotes: sanitizeStringList(product.riskNotes),
    suitableFor: sanitizeStringList(product.suitableFor),
    scentTags: sanitizeStringList(product.scentTags),
    aromaScores: product.aromaScores,
    inventoryStatus: product.inventoryStatus
  };
}

export async function listProducts(): Promise<{ products: Product[]; mode: "local" | "postgresql" }> {
  const db = await getDatabase();
  if (!db) return { products: await readLocalProducts(), mode: "local" };

  const { rows } = await db.query<ProductRow>("select * from products order by created_at desc");
  return {
    products: rows.map(mapProductRow),
    mode: "postgresql"
  };
}

export async function createProduct(input: ProductInput): Promise<{ product: Product; mode: "local" | "postgresql" }> {
  const payload = validateProductInput(input);
  const db = await getDatabase();

  if (!db) {
    const products = await readLocalProducts();
    const product: Product = { id: crypto.randomUUID(), ...payload };
    await writeLocalProducts([product, ...products]);
    return { product, mode: "local" };
  }

  const { rows } = await db.query<ProductRow>(
    `insert into products
      (name, product_type, region, price_cents, budget_level, description, risk_notes, suitable_for, scent_tags, aroma_scores, inventory_status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
     returning *`,
    productSqlValues(payload)
  );

  return { product: mapProductRow(rows[0]), mode: "postgresql" };
}

export async function updateProduct(
  id: string,
  input: ProductPatchInput
): Promise<{ product: Product; mode: "local" | "postgresql" }> {
  const db = await getDatabase();

  if (!db) {
    const products = await readLocalProducts();
    const index = products.findIndex((product) => product.id === id);
    if (index === -1) throw new Error("未找到要修改的商品。");
    const payload = validateProductInput(buildProductUpdateInput(products[index], input));
    const product: Product = { id, ...payload };
    const nextProducts = [...products];
    nextProducts[index] = product;
    await writeLocalProducts(nextProducts);
    return { product, mode: "local" };
  }

  const current = await db.query<ProductRow>("select * from products where id = $1 limit 1", [id]);
  if (!current.rows[0]) throw new Error("未找到要修改的商品。");

  const payload = validateProductInput(buildProductUpdateInput(mapProductRow(current.rows[0]), input));
  const { rows } = await db.query<ProductRow>(
    `update products
     set
      name = $1,
      product_type = $2,
      region = $3,
      price_cents = $4,
      budget_level = $5,
      description = $6,
      risk_notes = $7,
      suitable_for = $8,
      scent_tags = $9,
      aroma_scores = $10::jsonb,
      inventory_status = $11,
      updated_at = now()
     where id = $12
     returning *`,
    [...productSqlValues(payload), id]
  );

  if (!rows[0]) throw new Error("未找到要修改的商品。");
  return { product: mapProductRow(rows[0]), mode: "postgresql" };
}

export async function importProducts(inputs: ProductInput[]): Promise<ProductImportResult> {
  const db = await getDatabase();
  const current = db ? (await listProducts()).products : await readLocalProducts();
  const byKey = new Map(current.map((product) => [productKey(product), product]));
  const currentProductIds = new Set(current.map((product) => product.id));
  const queuedByKey = new Map<string, Product>();
  const errors: string[] = [];
  let skippedCount = 0;

  for (const [index, input] of inputs.entries()) {
    try {
      const payload = validateProductInput(input);
      const existing = byKey.get(productKey(payload));
      const candidate: Product = { id: existing?.id ?? crypto.randomUUID(), ...payload };
      const key = productKey(candidate);
      if (existing && sameProduct(existing, candidate)) {
        skippedCount += 1;
        continue;
      }
      byKey.set(key, candidate);
      queuedByKey.set(key, candidate);
    } catch (error) {
      errors.push(`第 ${index + 1} 条：${error instanceof Error ? error.message : "商品格式不正确"}`);
    }
  }

  const products = Array.from(queuedByKey.values());
  const createdCount = products.filter((product) => !currentProductIds.has(product.id)).length;
  const updatedCount = products.length - createdCount;

  if (products.length === 0) {
    return {
      createdCount: 0,
      updatedCount: 0,
      skippedCount,
      products: [],
      errors,
      mode: db ? "postgresql" : "local"
    };
  }

  if (!db) {
    await writeLocalProducts(Array.from(byKey.values()));
    return { createdCount, updatedCount, skippedCount, products, errors, mode: "local" };
  }

  const savedProducts = await db.transaction(async (client) => {
    const rows: ProductRow[] = [];
    for (const { id, ...product } of products) {
      const result = currentProductIds.has(id)
        ? await client.query<ProductRow>(
            `update products
             set
              name = $1,
              product_type = $2,
              region = $3,
              price_cents = $4,
              budget_level = $5,
              description = $6,
              risk_notes = $7,
              suitable_for = $8,
              scent_tags = $9,
              aroma_scores = $10::jsonb,
              inventory_status = $11,
              updated_at = now()
             where id = $12
             returning *`,
            [...productSqlValues(product), id]
          )
        : await client.query<ProductRow>(
            `insert into products
              (name, product_type, region, price_cents, budget_level, description, risk_notes, suitable_for, scent_tags, aroma_scores, inventory_status)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
             returning *`,
            productSqlValues(product)
          );
      rows.push(result.rows[0]);
    }
    return rows;
  });

  return {
    createdCount,
    updatedCount,
    skippedCount,
    products: savedProducts.map(mapProductRow),
    errors,
    mode: "postgresql"
  };
}

export function parseProductRows(rows: Record<string, unknown>[]): ProductInput[] {
  return rows
    .map((row) => normalizeImportRow(normalizeRowKeys(row)))
    .filter((row): row is ProductInput => Boolean(sanitizeTextValue(row.name)));
}

export function parseProductText(content: string): ProductInput[] {
  const tableRows = parseMarkdownTables(content);
  if (tableRows.length > 0) return parseProductRows(tableRows);
  return parseProductRows(parseFieldBlocks(content));
}

function buildProductUpdateInput(existing: Product, input: ProductPatchInput): ProductInput {
  return {
    ...existing,
    ...input,
    aromaScores: {
      ...existing.aromaScores,
      ...(isRecord(input.aromaScores) ? input.aromaScores : {})
    }
  };
}

function mapProductRow(row: ProductRow): Product {
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

function productSqlValues(product: Omit<Product, "id">) {
  return [
    product.name,
    product.type,
    product.region,
    product.priceCents,
    product.budgetLevel,
    product.description,
    product.riskNotes,
    product.suitableFor,
    product.scentTags,
    JSON.stringify(product.aromaScores),
    product.inventoryStatus
  ];
}

async function readLocalProducts(): Promise<Product[]> {
  try {
    const content = await readFile(LOCAL_PRODUCTS_PATH, "utf8");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [...sampleProducts];
    return parsed.flatMap((item) => {
      try {
        return [{ id: item.id ?? crypto.randomUUID(), ...validateProductInput(item) }];
      } catch {
        return [];
      }
    });
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
  const value = (aliases: string[], fallback = "") => sanitizeTextValue(readAlias(row, aliases) ?? fallback);
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

    const field = rawLine.match(/^\s*[-*]?\s*([^:：]+)[:：]\s*(.+?)\s*$/);
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

function normalizeRowKeys(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/^\uFEFF/, "").trim(), value]));
}

function splitList(value: string) {
  return sanitizeStringList(value.split(/[,，、\n]/).map((item) => item.trim()));
}

function normalizeProductType(value: string): ProductType {
  if (["bracelet", "手串", "首饰"].some((item) => value.includes(item))) return "bracelet";
  if (["powder", "香粉", "粉"].some((item) => value.includes(item))) return "powder";
  if (["incense", "线香", "方条香", "盘香", "香"].some((item) => value.includes(item))) return "incense";
  if (["object", "摆件", "器物"].some((item) => value.includes(item))) return "object";
  if (["investment", "收藏", "奇楠"].some((item) => value.includes(item))) return "investment";
  return "wood";
}

function inferTypeFromTags(tags: string[]) {
  return tags.join(" ");
}

function inferRegion(value: string) {
  if (value.includes("海南")) return "海南";
  if (value.includes("电白")) return "电白";
  if (value.includes("惠安")) return "惠安系";
  if (value.includes("星洲") || value.includes("加里曼丹")) return "星洲系";
  if (value.includes("芽庄")) return "芽庄";
  if (value.includes("达拉干")) return "达拉干";
  if (value.includes("柬埔寨")) return "柬埔寨";
  if (value.includes("马泥涝")) return "马泥涝";
  if (value.includes("奇楠")) return "奇楠";
  if (["包装", "香炉", "炉", "香盒", "盒", "葫芦", "香刀"].some((item) => value.includes(item))) {
    return "配套用品";
  }
  if (["茶", "精油", "烟丝"].some((item) => value.includes(item))) return "沉香制品";
  return "";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function sameProduct(left: Product, right: Product) {
  return JSON.stringify(productComparable(left)) === JSON.stringify(productComparable(right));
}

function productComparable(product: Product) {
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
