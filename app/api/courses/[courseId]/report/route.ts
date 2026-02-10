import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const uid = await getCurrentUserId();
    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "Not logged in" },
        { status: 401 }
      );
    }
    const body = await _request.json();
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : undefined;
    if (!reason) {
      return NextResponse.json(
        { ok: false, error: "Reason is required" },
        { status: 400 }
      );
    }
    const [course, user] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.user.findUnique({ where: { id: uid } }),
    ]);
    if (!course || !user) {
      return NextResponse.json(
        { ok: false, error: "Course or user not found" },
        { status: 404 }
      );
    }
    await prisma.report.create({
      data: {
        userId: uid,
        courseId,
        reason,
        description: description ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/courses/[courseId]/report", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
