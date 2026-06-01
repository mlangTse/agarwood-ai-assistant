import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "agarwood-ai-assistant",
    timestamp: new Date().toISOString()
  });
}
