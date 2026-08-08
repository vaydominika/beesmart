import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canManageCourse } from "@/lib/course-access";

type RouteContext = { params: Promise<{ courseId: string; fileId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { courseId, fileId } = await ctx.params;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { createdById: true },
    });

    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await req.json();
    if (typeof data.isVisible !== "boolean") {
      return NextResponse.json({ error: "isVisible must be a boolean" }, { status: 400 });
    }

    const file = await prisma.courseFile.findUnique({
      where: { id: fileId },
      include: {
        lesson: {
          select: {
            module: { select: { courseId: true } },
          },
        },
      },
    });

    const belongsToCourse = file?.courseId === courseId || file?.lesson?.module.courseId === courseId;
    if (!file || !belongsToCourse) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const updated = await prisma.courseFile.update({
      where: { id: fileId },
      data: { isVisible: data.isVisible },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileSize: true,
        isVisible: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/courses/[courseId]/files/[fileId]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
