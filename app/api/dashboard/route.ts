import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/courses-data";

export async function GET() {
  try {
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
