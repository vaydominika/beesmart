import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/db";
import { getPublicProfile } from "@/lib/public-profile";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const viewerUserId = await getCurrentUserId();
  if (!viewerUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await context.params;
  const result = await getPublicProfile(userId, viewerUserId);
  if (result.status === "not_found") return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (result.status === "private") return NextResponse.json({ error: "This profile is private", user: result.user }, { status: 403 });
  return NextResponse.json(result.profile);
}
