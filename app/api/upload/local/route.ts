import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "This upload endpoint has been replaced by /api/uploads" }, { status: 410 });
}
