import { NextRequest, NextResponse } from "next/server";
import { createRegion, listRegions } from "@/lib/regions";

export async function GET() {
  try {
    const result = await listRegions();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取产区失败。" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await createRegion(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存产区失败。" },
      { status: 400 }
    );
  }
}
