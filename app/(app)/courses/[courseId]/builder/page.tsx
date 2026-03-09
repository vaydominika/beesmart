import { getCurrentUserId, prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import CourseBuilderClient from "@/components/course/CourseBuilderClient";

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
                    },
                },
            },
        },
    });

    if (!course) notFound();

    // Check if user is the creator
    if (course.createdById !== userId) {
        redirect(`/courses/${courseId}`); // redirect to student view if not creator
    }

    // Pass data to client component
    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background">
            <CourseBuilderClient initialCourse={course} />
        </div>
    );
}
