import { redirect } from "next/navigation";
import { prisma, getCurrentUserId } from "@/lib/db";
import CourseViewerClient from "@/components/course/CourseViewerClient";

type ViewerPageProps = { params: Promise<{ courseId: string }> };

export default async function CourseViewerPage({ params }: ViewerPageProps) {
    const userId = await getCurrentUserId();
    if (!userId) redirect("/login");

    const { courseId } = await params;

    // Check enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } }
    });

    const courseData = await prisma.course.findUnique({
        where: { id: courseId },
        select: { createdById: true }
    });

    const isCreator = courseData?.createdById === userId;

    if (!enrollment && !isCreator) {
        redirect(`/courses/${courseId}`);
    }

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
            modules: {
                include: {
                    lessons: {
                        orderBy: { order: "asc" },
                        select: {
                            id: true,
                            title: true,
                            content: true,
                            order: true,
                            files: true
                        }
                    }
                },
                orderBy: { order: "asc" }
            }
        }
    });

    if (!course) redirect("/courses");

    const progress = await prisma.courseProgress.findMany({
        where: { userId, courseId },
        select: { lessonId: true, completedAt: true, lastAccessedAt: true }
    });

    const completedLessonIds = progress
        .filter((p: any) => !!p.completedAt)
        .map((p: any) => p.lessonId);

    const lastAccessed = progress.sort((a: any, b: any) =>
        b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
    )[0];

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <CourseViewerClient
                course={course}
                initialCompletedLessonIds={completedLessonIds}
                initialLessonId={lastAccessed?.lessonId}
            />
        </div>
    );
}
