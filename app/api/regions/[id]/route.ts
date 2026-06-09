import { NextRequest, NextResponse } from "next/server";
import { updateRegion } from "@/lib/regions";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await updateRegion(params.id, await request.json());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "修改产区失败。";
    return NextResponse.json(
      { error: message },
      { status: message.includes("未找到") ? 404 : 400 }
    );
  }
}
