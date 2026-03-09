import { redirect } from "next/navigation";
import { prisma, getCurrentUserId } from "@/lib/db";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, UserIcon, Book02Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { BadgeCheck, Clock, BookOpen, Layers } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EnrollButton } from "@/components/course/EnrollButton";

type CoursePageProps = { params: Promise<{ courseId: string }> };

export default async function CourseOverviewPage({ params }: CoursePageProps) {
    const userId = await getCurrentUserId();
    const { courseId } = await params;

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
            creator: { select: { name: true, avatar: true } },
            modules: {
                include: { lessons: { select: { id: true, title: true } } },
                orderBy: { order: "asc" }
            },
            enrollments: userId ? { where: { userId } } : false,
            _count: { select: { enrollments: true, modules: true } }
        }
    });

    if (!course || (!course.published && course.createdById !== userId)) {
        redirect("/courses");
    }

    const isEnrolled = course.enrollments.length > 0;
    const isCreator = course.createdById === userId;
    const totalLessons = course.modules.reduce((acc: number, m: any) => acc + m.lessons.length, 0);

    return (
        <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Info & Syllabus */}
                    <div className="lg:col-span-2 space-y-8">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-4">
                                {course.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-200 p-1.5 rounded-lg">
                                        <HugeiconsIcon icon={UserIcon} className="size-4" />
                                    </div>
                                    {course.creator.name}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-200 p-1.5 rounded-lg">
                                        <Layers className="size-4" />
                                    </div>
                                    {course.modules.length} Modules
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-200 p-1.5 rounded-lg">
                                        <BookOpen className="size-4" />
                                    </div>
                                    {totalLessons} Lessons
                                </div>
                            </div>
                        </div>

                        <FancyCard className="p-8 bg-white border-none shadow-sm overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                <HugeiconsIcon icon={Book02Icon} className="size-32" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 uppercase mb-4 flex items-center gap-2">
                                <div className="bg-black text-white p-1.5 rounded-lg">
                                    <BadgeCheck className="size-5" />
                                </div>
                                About this course
                            </h3>
                            <div
                                className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: course.description || "No description provided." }}
                            />
                        </FancyCard>

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-slate-900 uppercase flex items-center gap-2">
                                <div className="bg-black text-white p-1.5 rounded-lg">
                                    <Layers className="size-5" />
                                </div>
                                Course Syllabus
                            </h3>
                            <div className="space-y-3">
                                {course.modules.map((module: any, idx: number) => (
                                    <FancyCard key={module.id} className="p-5 bg-white border-slate-100 hover:border-slate-200 transition-all">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-slate-100 text-slate-400 font-black text-xl size-10 flex items-center justify-center rounded-xl shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 uppercase truncate">
                                                    {module.title}
                                                </h4>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">
                                                    {module.lessons.length} Lessons
                                                </p>
                                                <div className="space-y-2">
                                                    {module.lessons.map((lesson: any) => (
                                                        <div key={lesson.id} className="flex items-center gap-2 text-sm text-slate-600 font-medium border-l-2 border-slate-100 pl-3 py-1">
                                                            <div className="size-1 bg-slate-300 rounded-full" />
                                                            {lesson.title}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </FancyCard>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Sticky Enroll Card */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6 space-y-4">
                            <FancyCard className="bg-white border-none shadow-xl overflow-hidden p-4">
                                <div className="relative aspect-video w-full rounded-2xl overflow-hidden mb-6 corner-squircle">
                                    {course.coverImageUrl ? (
                                        <Image src={course.coverImageUrl} alt={course.title} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                                            <HugeiconsIcon icon={Book02Icon} className="size-12 text-slate-400" />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 px-2 pb-2">
                                    {(isEnrolled || isCreator) ? (
                                        <Link href={`/courses/${courseId}/${isCreator ? 'builder' : 'viewer'}`} className="block">
                                            <FancyButton className="w-full bg-black text-white hover:opacity-90 py-6 text-xl font-bold uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]">
                                                <HugeiconsIcon icon={PlayIcon} className="mr-2" />
                                                Go to Course
                                            </FancyButton>
                                        </Link>
                                    ) : (
                                        <EnrollButton courseId={courseId} />
                                    )}

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-slate-400 mb-1">
                                                <Clock className="size-5 mx-auto" />
                                            </div>
                                            <div className="text-xs font-bold text-slate-400 uppercase">Duration</div>
                                            <div className="text-sm font-black text-slate-900 uppercase">Self-Paced</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-slate-400 mb-1">
                                                <HugeiconsIcon icon={Calendar03Icon} className="size-5 mx-auto" />
                                            </div>
                                            <div className="text-xs font-bold text-slate-400 uppercase">Level</div>
                                            <div className="text-sm font-black text-slate-900 uppercase">Beginner</div>
                                        </div>
                                    </div>
                                </div>
                            </FancyCard>

                            <FancyCard className="bg-slate-900 text-white p-6 border-none">
                                <h4 className="font-bold uppercase tracking-wider mb-2 text-slate-400 text-sm">Course includes:</h4>
                                <ul className="space-y-3 text-sm font-bold uppercase tracking-tight">
                                    <li className="flex items-center gap-3">
                                        <div className="size-6 bg-white/10 rounded-lg flex items-center justify-center">
                                            <BadgeCheck className="size-4" />
                                        </div>
                                        Lifetime Access
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="size-6 bg-white/10 rounded-lg flex items-center justify-center">
                                            <BookOpen className="size-4" />
                                        </div>
                                        {totalLessons} Full Lessons
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="size-6 bg-white/10 rounded-lg flex items-center justify-center">
                                            <Layers className="size-4" />
                                        </div>
                                        Downloadable resources
                                    </li>
                                </ul>
                            </FancyCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
