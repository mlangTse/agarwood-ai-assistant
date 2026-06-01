import { NextRequest, NextResponse } from "next/server";
import { inferUserPreference } from "@/lib/recommendation";

export async function POST(request: NextRequest) {
  const { message } = (await request.json()) as { message?: string };
  return NextResponse.json({ preference: inferUserPreference(message ?? "") });
}
