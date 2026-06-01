import { NextRequest, NextResponse } from "next/server";
import { createProduct, listProducts } from "@/lib/products";

export async function GET() {
  try {
    const result = await listProducts();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取商品失败。" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await createProduct(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存商品失败。" },
      { status: 400 }
    );
  }
}
