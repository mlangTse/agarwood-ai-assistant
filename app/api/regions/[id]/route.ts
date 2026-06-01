import { NextRequest, NextResponse } from "next/server";
import { updateRegion } from "@/lib/regions";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await updateRegion(params.id, await request.json());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "修改产区失败。" },
      { status: error instanceof Error && error.message.includes("未找到") ? 404 : 400 }
    );
  }
}
