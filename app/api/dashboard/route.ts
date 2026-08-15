import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/courses-data";
import { getCurrentUserId } from "@/lib/db";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (e) {
    console.error("GET /api/dashboard", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
