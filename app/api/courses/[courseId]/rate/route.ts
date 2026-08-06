import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { courseId } = await params;

  const [course, currentRating, aggregate, enrollment, startedProgress] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, createdById: true } }),
    prisma.courseRating.findUnique({ where: { userId_courseId: { userId, courseId } } }),
    prisma.courseRating.aggregate({ where: { courseId }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.courseEnrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { completedAt: true } }),
    prisma.courseProgress.findFirst({ where: { userId, courseId }, select: { id: true } }),
  ]);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  return NextResponse.json({
    currentRating: currentRating ? { rating: currentRating.rating, comment: currentRating.comment } : null,
    averageRating: aggregate._avg.rating == null ? null : Math.round(aggregate._avg.rating * 10) / 10,
    ratingCount: aggregate._count.rating,
    canRate: course.createdById !== userId && Boolean(currentRating || enrollment?.completedAt || startedProgress),
  });
}

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
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || Number.isNaN(rating)) {
      return NextResponse.json(
        { ok: false, error: "Rating must be 1–5" },
        { status: 400 }
      );
    }
    if (comment && comment.length > 500) {
      return NextResponse.json({ ok: false, error: "Comment must be 500 characters or fewer" }, { status: 400 });
    }
    const [course, user] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId }, select: { id: true, createdById: true } }),
      prisma.user.findUnique({ where: { id: uid } }),
    ]);
    if (!course || !user) {
      return NextResponse.json(
        { ok: false, error: "Course or user not found" },
        { status: 404 }
      );
    }
    if (course.createdById === uid) {
      return NextResponse.json({ ok: false, error: "You cannot rate your own course" }, { status: 403 });
    }
    const [enrollment, existingRating, startedProgress] = await Promise.all([
      prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId: uid, courseId } },
        select: { completedAt: true },
      }),
      prisma.courseRating.findUnique({
        where: { userId_courseId: { userId: uid, courseId } },
        select: { id: true },
      }),
      prisma.courseProgress.findFirst({
        where: { userId: uid, courseId },
        select: { id: true },
      }),
    ]);
    if ((!enrollment || (!enrollment.completedAt && !startedProgress)) && !existingRating) {
      return NextResponse.json({ ok: false, error: "Start the course before rating it" }, { status: 403 });
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
      _count: { rating: true },
    });
    const avg = agg._avg.rating;
    return NextResponse.json({
      ok: true,
      averageRating: avg != null ? Math.round(avg * 10) / 10 : undefined,
      ratingCount: agg._count.rating,
      currentRating: { rating, comment: comment ?? null },
    });
  } catch (e) {
    console.error("POST /api/courses/[courseId]/rate", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
