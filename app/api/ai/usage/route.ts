import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/db";
import { getAiUsage } from "@/lib/ai/usage";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getAiUsage(userId));
}
