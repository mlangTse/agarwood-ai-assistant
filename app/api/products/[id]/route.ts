import { NextRequest, NextResponse } from "next/server";
import { updateProduct } from "@/lib/products";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await updateProduct(params.id, await request.json());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "修改商品失败。";
    return NextResponse.json(
      { error: message },
      { status: message.includes("未找到") ? 404 : 400 }
    );
  }
}
