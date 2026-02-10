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
    const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
    const comment =
      typeof body.comment === "string" ? body.comment.trim() : undefined;
    if (rating < 1 || rating > 5 || Number.isNaN(rating)) {
      return NextResponse.json(
        { ok: false, error: "Rating must be 1–5" },
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
    await prisma.courseRating.upsert({
      where: {
        userId_courseId: { userId: uid, courseId },
      },
      create: { userId: uid, courseId, rating, comment: comment ?? null },
      update: { rating, comment: comment ?? null },
    });
    const agg = await prisma.courseRating.aggregate({
      where: { courseId },
      _avg: { rating: true },
    });
    const avg = agg._avg.rating;
    return NextResponse.json({
      ok: true,
      averageRating: avg != null ? Math.round(avg * 10) / 10 : undefined,
    });
  } catch (e) {
    console.error("POST /api/courses/[courseId]/rate", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
