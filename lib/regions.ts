import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { regionNotes } from "@/lib/sample-data";
import type { Region } from "@/lib/types";

export type RegionImportResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  regions: Region[];
  errors: string[];
  mode: "local" | "postgresql";
};

const LOCAL_REGIONS_PATH = path.join(process.cwd(), "data", "regions.json");

const regionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  country: z.string().default(""),
  aromaCharacter: z.string().min(1),
  typicalScenes: z.array(z.string()).default([]),
  riskNotes: z.array(z.string()).default([])
});

type RegionInput = z.input<typeof regionSchema>;
type RegionPayload = Omit<Region, "id" | "character" | "scenes">;

type RegionRow = {
  id: string;
  name: string;
  country: string | null;
  aroma_character: string;
  typical_scenes: string[] | null;
  risk_notes: string[] | null;
};

export function validateRegionInput(input: RegionInput): RegionPayload {
  const region = regionSchema.parse(input);
  return {
    name: region.name,
    country: region.country ?? "",
    aromaCharacter: region.aromaCharacter,
    typicalScenes: region.typicalScenes ?? [],
    riskNotes: region.riskNotes ?? []
  };
}

export async function listRegions(): Promise<{ regions: Region[]; mode: "local" | "postgresql" }> {
  const db = await getDatabase();
  if (!db) return { regions: (await readLocalRegions()).map(withRegionAliases), mode: "local" };

  const { rows } = await db.query<RegionRow>("select * from incense_regions order by name");
  return { regions: rows.map(mapRegionRow).map(withRegionAliases), mode: "postgresql" };
}

export async function createRegion(input: RegionInput): Promise<{ region: Region; mode: "local" | "postgresql" }> {
  const payload = validateRegionInput(input);
  const db = await getDatabase();

  if (!db) {
    const regions = await readLocalRegions();
    if (regions.some((region) => normalizeKey(region.name) === normalizeKey(payload.name))) {
      throw new Error("产区名称已存在。");
    }
    const region: Region = { id: crypto.randomUUID(), ...payload };
    await writeLocalRegions([region, ...regions]);
    return { region: withRegionAliases(region), mode: "local" };
  }

  await assertUniqueRegionName(db, payload.name);

  const { rows } = await db.query<RegionRow>(
    `insert into incense_regions (name, country, aroma_character, typical_scenes, risk_notes)
     values ($1, $2, $3, $4, $5)
     on conflict (name) do nothing
     returning *`,
    regionSqlValues(payload)
  );

  if (!rows[0]) throw new Error("产区名称已存在。");
  return { region: withRegionAliases(mapRegionRow(rows[0])), mode: "postgresql" };
}

export async function updateRegion(
  id: string,
  input: RegionInput
): Promise<{ region: Region; mode: "local" | "postgresql" }> {
  const payload = validateRegionInput(input);
  const db = await getDatabase();

  if (!db) {
    const regions = await readLocalRegions();
    const index = regions.findIndex((region) => region.id === id);
    if (index === -1) throw new Error("未找到要修改的产区。");
    if (regions.some((region) => region.id !== id && normalizeKey(region.name) === normalizeKey(payload.name))) {
      throw new Error("产区名称已存在。");
    }
    const region: Region = { id, ...payload };
    const nextRegions = [...regions];
    nextRegions[index] = region;
    await writeLocalRegions(nextRegions);
    return { region: withRegionAliases(region), mode: "local" };
  }

  await assertUniqueRegionName(db, payload.name, id);

  const { rows } = await db.query<RegionRow>(
    `update incense_regions
     set name = $1, country = $2, aroma_character = $3, typical_scenes = $4, risk_notes = $5
     where id = $6
     returning *`,
    [...regionSqlValues(payload), id]
  );

  if (!rows[0]) throw new Error("未找到要修改的产区。");
  return { region: withRegionAliases(mapRegionRow(rows[0])), mode: "postgresql" };
}

export async function importRegions(inputs: RegionInput[]): Promise<RegionImportResult> {
  const db = await getDatabase();
  const current = db ? (await listRegions()).regions : await readLocalRegions();
  const byName = new Map(current.map((region) => [normalizeKey(region.name), region]));
  const errors: string[] = [];
  const currentRegionIds = new Set(current.map((region) => region.id));
  const queuedByName = new Map<string, Region>();
  let skippedCount = 0;

  for (const [index, input] of inputs.entries()) {
    try {
      const payload = validateRegionInput(input);
      const key = normalizeKey(payload.name);
      const existing = byName.get(key);
      if (existing && sameRegion(existing, payload)) {
        skippedCount += 1;
        continue;
      }
      const region: Region = { id: existing?.id ?? crypto.randomUUID(), ...payload };
      byName.set(key, region);
      queuedByName.set(key, region);
    } catch (error) {
      errors.push(`第 ${index + 1} 行：${error instanceof Error ? error.message : "产区格式不正确。"}`);
    }
  }

  const regions = Array.from(queuedByName.values());
  const createdCount = regions.filter((region) => !currentRegionIds.has(region.id)).length;
  const updatedCount = regions.length - createdCount;

  if (regions.length === 0) {
    return { createdCount, updatedCount, skippedCount, regions: [], errors, mode: db ? "postgresql" : "local" };
  }

  if (!db) {
    await writeLocalRegions(Array.from(byName.values()));
    return { createdCount, updatedCount, skippedCount, regions: regions.map(withRegionAliases), errors, mode: "local" };
  }

  const savedRegions = await db.transaction(async (client) => {
    const rows: RegionRow[] = [];
    for (const region of regions) {
      const values = regionSqlValues(region);
      const result = currentRegionIds.has(region.id)
        ? await client.query<RegionRow>(
            `update incense_regions
             set name = $1,
                 country = $2,
                 aroma_character = $3,
                 typical_scenes = $4,
                 risk_notes = $5
             where id = $6
             returning *`,
            [...values, region.id]
          )
        : await client.query<RegionRow>(
            `insert into incense_regions (name, country, aroma_character, typical_scenes, risk_notes)
             values ($1, $2, $3, $4, $5)
             returning *`,
            values
          );
      rows.push(result.rows[0]);
    }
    return rows;
  });

  return {
    createdCount,
    updatedCount,
    skippedCount,
    regions: savedRegions.map(mapRegionRow).map(withRegionAliases),
    errors,
    mode: "postgresql"
  };
}

export function parseRegionRows(rows: Record<string, unknown>[]): RegionInput[] {
  return rows.map((row) => normalizeImportRow(normalizeRowKeys(row))).filter((row): row is RegionInput => Boolean(row.name));
}

export function parseRegionText(content: string): RegionInput[] {
  const tableRows = parseMarkdownTables(content);
  if (tableRows.length > 0) return parseRegionRows(tableRows);
  return parseRegionRows(parseFieldBlocks(content));
}

function mapRegionRow(row: RegionRow): Region {
  return {
    id: row.id,
    name: row.name,
    country: row.country ?? "",
    aromaCharacter: row.aroma_character,
    typicalScenes: row.typical_scenes ?? [],
    riskNotes: row.risk_notes ?? []
  };
}

function withRegionAliases(region: Region): Region {
  return {
    ...region,
    character: region.aromaCharacter,
    scenes: region.typicalScenes
  };
}

function regionSqlValues(region: RegionPayload) {
  return [region.name, region.country, region.aromaCharacter, region.typicalScenes, region.riskNotes];
}

async function assertUniqueRegionName(db: NonNullable<Awaited<ReturnType<typeof getDatabase>>>, name: string, exceptId?: string) {
  const { rows } = await db.query<{ id: string }>(
    `select id
     from incense_regions
     where lower(name) = lower($1)
       and ($2::uuid is null or id <> $2::uuid)
     limit 1`,
    [name, exceptId ?? null]
  );
  if (rows.length > 0) throw new Error("产区名称已存在。");
}

async function readLocalRegions(): Promise<Region[]> {
  try {
    const content = await readFile(LOCAL_REGIONS_PATH, "utf8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({ id: item.id ?? crypto.randomUUID(), ...validateRegionInput(item) }));
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }

  const seeded = regionNotes.map((region) => ({
    id: crypto.randomUUID(),
    name: region.name,
    country: "",
    aromaCharacter: "character" in region ? String(region.character) : "",
    typicalScenes: "scenes" in region && Array.isArray(region.scenes) ? region.scenes : [],
    riskNotes: []
  }));
  await writeLocalRegions(seeded);
  return seeded;
}

async function writeLocalRegions(regions: Region[]) {
  await mkdir(path.dirname(LOCAL_REGIONS_PATH), { recursive: true });
  await writeFile(LOCAL_REGIONS_PATH, `${JSON.stringify(regions, null, 2)}\n`, "utf8");
}

function normalizeImportRow(row: Record<string, unknown>): RegionInput {
  const value = (aliases: string[], fallback = "") => String(readAlias(row, aliases) ?? fallback).trim();
  return {
    name: value(["name", "名称", "产区", "产区名称", "region", "title"]),
    country: value(["country", "国家", "国家/地区", "地区", "来源"]),
    aromaCharacter: value(["aromaCharacter", "aroma_character", "香韵特点", "香气特点", "特点", "character", "description"]),
    typicalScenes: splitList(value(["typicalScenes", "typical_scenes", "典型场景", "适用场景", "场景", "scenes"])),
    riskNotes: splitList(value(["riskNotes", "risk_notes", "风险提示", "风险", "注意事项"]))
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
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") return row[alias];
  }
  return undefined;
}

function normalizeRowKeys(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/^\uFEFF/, "").trim(), value]));
}

function splitList(value: string) {
  return value
    .split(/[,，、;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function sameRegion(left: Region, right: Omit<Region, "id">) {
  return (
    left.name === right.name &&
    left.country === right.country &&
    left.aromaCharacter === right.aromaCharacter &&
    left.typicalScenes.join("\n") === right.typicalScenes.join("\n") &&
    left.riskNotes.join("\n") === right.riskNotes.join("\n")
  );
}
