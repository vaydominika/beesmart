import { getCurrentUserId, prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import CourseBuilderClient from "@/components/course/CourseBuilderClient";
import { storedFileUrl } from "@/lib/files/types";

export default async function CourseBuilderPage({
    params,
}: {
    params: Promise<{ courseId: string }>;
}) {
    const userId = await getCurrentUserId();
    if (!userId) redirect("/login");

    const { courseId } = await params;

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
            modules: {
                orderBy: { order: "asc" },
                include: {
                    lessons: {
                        orderBy: { order: "asc" },
                        include: { files: true },
                    },
                },
            },
        },
    });

    if (!course) notFound();

    // Check if user is the creator
    if (course.createdById !== userId) {
        redirect(`/courses/${courseId}`); // Redirect to the learner view when the user is not the creator.
    }

    return (
        <div className="course-ui flex h-[calc(100dvh-65px)] min-h-0 w-full overflow-hidden bg-[var(--course-canvas)] md:h-screen">
            <CourseBuilderClient initialCourse={{
                ...course,
                coverImageUrl: storedFileUrl(course.coverStoredFileId, course.coverImageUrl) || null,
                modules: course.modules.map((module: any) => ({
                    ...module,
                    lessons: module.lessons.map((lesson: any) => ({
                        ...lesson,
                        files: lesson.files.map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })),
                    })),
                })),
            }} />
        </div>
    );
}
