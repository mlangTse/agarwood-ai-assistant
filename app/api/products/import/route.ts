import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { importProducts, parseProductRows, parseProductText } from "@/lib/products";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传 Excel / Markdown / TXT 文件。" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const products = parseImportFile(file, buffer);
    if (products.length === 0) {
      return NextResponse.json({ error: "没有识别到可导入的商品。请检查表头或文本字段。" }, { status: 400 });
    }

    const result = await importProducts(products);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? `导入失败：${error.message}` : "导入失败：服务器处理商品文件时出错。"
      },
      { status: 500 }
    );
  }
}

function parseImportFile(file: File, buffer: Buffer) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    return parseProductRows(rows);
  }

  const text = buffer.toString("utf8");
  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    const delimiter = name.endsWith(".tsv") ? "\t" : ",";
    return parseProductRows(parseDelimitedText(text, delimiter));
  }

  return parseProductText(text);
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => splitDelimitedLine(line, delimiter))
    .filter((row) => row.some(Boolean));
  const [headers, ...values] = rows;
  if (!headers) return [];
  return values.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}
