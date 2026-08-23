import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/db";
import {
  CourseRecommendationError,
  courseRecommendationKindSchema,
  getDailyCourseRecommendation,
} from "@/lib/ai/course-recommendations";

type RouteContext = { params: Promise<{ kind: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { kind: rawKind } = await context.params;
    const parsedKind = courseRecommendationKindSchema.safeParse(rawKind);
    if (!parsedKind.success) {
      return NextResponse.json(
        { error: "Unknown recommendation type", code: "INVALID_RECOMMENDATION_KIND" },
        { status: 400 },
      );
    }

    const recommendation = await getDailyCourseRecommendation(userId, parsedKind.data);
    return NextResponse.json(recommendation, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof CourseRecommendationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: {
            "Cache-Control": "private, no-store",
            ...(error.code === "RECOMMENDATION_PENDING" ? { "Retry-After": "2" } : {}),
          },
        },
      );
    }
    console.error("POST /api/dashboard/recommendations/[kind]", error);
    return NextResponse.json(
      { error: "Today's course pick could not be prepared.", code: "RECOMMENDATION_UNAVAILABLE" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
