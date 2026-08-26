import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Layers3,
  Play,
  School,
  UserRound,
  UsersRound,
} from "lucide-react";
import { EnrollButton } from "@/components/course/EnrollButton";
import { CourseRatingButton } from "@/components/course/CourseRatingButton";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceProgress } from "@/components/ui/workspace-progress";
import { canAccessCourse } from "@/lib/course-access";
import { plainTextExcerpt } from "@/lib/course-summary";
import { getCurrentUserId, prisma } from "@/lib/db";
import { storedFileUrl } from "@/lib/files/types";

type CoursePageProps = { params: Promise<{ courseId: string }> };
type ClassroomSummary = { id: string; name: string };
type CourseOverviewData = {
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  coverStoredFileId: string | null;
  createdById: string;
  published: boolean;
  creator: { name: string | null };
  classroom: ClassroomSummary | null;
  classroomLinks: Array<{ classroom: ClassroomSummary }>;
  modules: Array<{ id: string; title: string; lessons: Array<{ id: string; title: string }> }>;
  enrollments: Array<{ id: string }>;
  _count: { enrollments: number };
};

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function CourseOverviewPage({ params }: CoursePageProps) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      creator: { select: { name: true } },
      classroom: { select: { id: true, name: true } },
      classroomLinks: { select: { classroom: { select: { id: true, name: true } } } },
      modules: {
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, title: true },
          },
        },
        orderBy: { order: "asc" },
      },
      enrollments: { where: { userId }, select: { id: true } },
      _count: { select: { enrollments: true } },
    },
  }) as CourseOverviewData | null;

  const hasAccess = course ? await canAccessCourse(courseId, userId) : false;
  if (!course || (!course.published && course.createdById !== userId) || !hasAccess) {
    redirect("/courses");
  }

  const isCreator = course.createdById === userId;
  course.coverImageUrl = storedFileUrl(course.coverStoredFileId, course.coverImageUrl) || null;
  const isEnrolled = course.enrollments.length > 0;
  const totalLessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const completedProgress = isEnrolled
    ? await prisma.courseProgress.findMany({
        where: { userId, courseId, completedAt: { not: null } },
        select: { lessonId: true },
      }) as Array<{ lessonId: string }>
    : [];
  const completedLessonIds = new Set(completedProgress.map((item) => item.lessonId));
  const completedLessons = completedLessonIds.size;
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const description = plainTextExcerpt(course.description);
  const classrooms = Array.from(
    new Map(
      [course.classroom, ...course.classroomLinks.map((link) => link.classroom)]
        .filter((classroom): classroom is { id: string; name: string } => Boolean(classroom))
        .map((classroom) => [classroom.id, classroom]),
    ).values(),
  );
  const destination = `/courses/${courseId}/${isCreator ? "builder" : "viewer"}`;
  const actionLabel = isCreator ? "Open builder" : progress > 0 ? "Continue course" : "Start course";

  return (
    <div className="course-ui min-h-full overflow-y-auto bg-[var(--course-canvas)] px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-[1500px]">
        <WorkspaceButton asChild variant="secondary" size="compact">
          <Link href="/courses">
            <ArrowLeft />Back to courses
          </Link>
        </WorkspaceButton>

        <header className="mt-6 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--course-text-muted)]">
            {isCreator || !isEnrolled ? (
              <span className="rounded-lg bg-[var(--course-accent)] px-2.5 py-1 text-[var(--course-text)]">
                {isCreator ? "Created by you" : "Available course"}
              </span>
            ) : null}
            {classrooms.map((classroom) => (
              <span key={classroom.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--course-surface-muted)] px-2.5 py-1">
                <School className="h-3.5 w-3.5" />{classroom.name}
              </span>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--course-text)] md:text-[46px]">
            {course.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--course-text-muted)]">
            <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" />{course.creator.name || "Course creator"}</span>
            <span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4" />{countLabel(course.modules.length, "module")}</span>
            <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" />{countLabel(totalLessons, "lesson")}</span>
          </div>
        </header>

        <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-5">
            <section className="rounded-2xl border border-[var(--course-line)] bg-[var(--app-surface)] p-5 md:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--course-accent)] text-[var(--course-text)]">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--course-text)]">About this course</h2>
                  <p className="text-xs text-[var(--course-text-muted)]">What you can expect before you begin</p>
                </div>
              </div>
              <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-6 text-[var(--course-text-muted)] md:text-[15px]">
                {description || "The creator has not added a course description yet. Review the syllabus below to see what is included."}
              </p>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[var(--course-line)] bg-[var(--app-surface)]">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--course-line)] px-5 py-4 md:px-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--course-text)]">Syllabus</h2>
                  <p className="mt-1 text-xs text-[var(--course-text-muted)]">{countLabel(course.modules.length, "module")} · {countLabel(totalLessons, "lesson")}</p>
                </div>
                {isEnrolled && !isCreator ? (
                  <span className="text-xs font-medium text-[var(--course-text-muted)]">{completedLessons} of {totalLessons} completed</span>
                ) : null}
              </div>

              {course.modules.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                  <Layers3 className="h-5 w-5 text-[var(--course-text-faint)]" />
                  <p className="mt-3 text-sm font-medium text-[var(--course-text)]">The syllabus is still being prepared</p>
                  <p className="mt-1 text-xs text-[var(--course-text-muted)]">Modules and lessons will appear here when they are ready.</p>
                </div>
              ) : (
                <ol className="divide-y divide-[var(--course-line)]">
                  {course.modules.map((module, moduleIndex) => (
                    <li key={module.id} className="grid gap-4 px-5 py-5 md:grid-cols-[44px_minmax(0,1fr)] md:px-6">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--course-accent)] font-mono text-xs font-semibold text-[var(--course-text)]">
                        {String(moduleIndex + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold text-[var(--course-text)]">{module.title}</h3>
                          <span className="text-xs text-[var(--course-text-muted)]">{countLabel(module.lessons.length, "lesson")}</span>
                        </div>
                        {module.lessons.length > 0 ? (
                          <ol className="mt-3 space-y-1.5">
                            {module.lessons.map((lesson, lessonIndex) => {
                              const completed = completedLessonIds.has(lesson.id);
                              return (
                                <li
                                  key={lesson.id}
                                  className={completed
                                    ? "flex min-h-9 items-center gap-3 rounded-lg border border-[var(--course-accent-hover)] bg-[var(--course-accent)] px-3 py-2 text-sm text-[var(--course-text)]"
                                    : "flex min-h-9 items-center gap-3 rounded-lg border border-transparent bg-[var(--course-surface-muted)] px-3 py-2 text-sm text-[var(--course-text-muted)]"}
                                >
                                  <span className="w-5 shrink-0 font-mono text-[10px] text-[var(--course-text-faint)]">{moduleIndex + 1}.{lessonIndex + 1}</span>
                                  <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                                  {completed ? (
                                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
                                      <CheckCircle2 className="h-4 w-4" />
                                      <span className="hidden sm:inline">Completed</span>
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--course-text-muted)]">Lessons have not been added yet.</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </main>

          <aside className="order-first lg:order-last lg:sticky lg:top-5">
            <div className="overflow-hidden rounded-2xl border border-[var(--course-line)] bg-[var(--app-surface)] p-4">
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[var(--course-surface-muted)]">
                {course.coverImageUrl ? (
                  <Image src={course.coverImageUrl} alt="" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 340px" unoptimized={course.coverImageUrl.startsWith("/api/files/")} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[var(--course-accent)]">
                    <BookOpen className="h-9 w-9 text-[var(--course-text-muted)]" />
                  </div>
                )}
              </div>

              <div className="px-1 pb-1 pt-4">
                <p className="text-sm font-semibold text-[var(--course-text)]">
                  {isCreator ? "Continue building your course" : isEnrolled ? (progress > 0 ? "Continue where you left off" : "Your course is ready") : "Ready to start learning?"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--course-text-muted)]">
                  {isCreator ? "Open the builder to manage lessons and publishing." : isEnrolled ? "Open the course to view lessons and track your progress." : "Enroll once to unlock the learner view and progress tracking."}
                </p>

                {isEnrolled && !isCreator ? (
                  <WorkspaceProgress value={progress} className="mt-4" trackClassName="mt-2 h-2" indicatorClassName="bg-[var(--app-accent)]" />
                ) : null}

                <div className="mt-4">
                  {isEnrolled || isCreator ? (
                    <WorkspaceButton asChild variant="primary" className="w-full">
                      <Link href={destination}><Play />{actionLabel}</Link>
                    </WorkspaceButton>
                  ) : (
                    <EnrollButton courseId={courseId} />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--course-line)] bg-[var(--app-surface)] px-4 py-2">
              <dl className="divide-y divide-[var(--course-line)] text-sm">
                <div className="flex items-center gap-3 py-3">
                  <UserRound className="h-4 w-4 text-[var(--course-text-faint)]" />
                  <dt className="text-[var(--course-text-muted)]">Created by</dt>
                  <dd className="ml-auto max-w-36 truncate font-medium text-[var(--course-text)]">{course.creator.name || "Course creator"}</dd>
                </div>
                <div className="flex items-center gap-3 py-3">
                  <Layers3 className="h-4 w-4 text-[var(--course-text-faint)]" />
                  <dt className="text-[var(--course-text-muted)]">Modules</dt>
                  <dd className="ml-auto font-medium text-[var(--course-text)]">{course.modules.length}</dd>
                </div>
                <div className="flex items-center gap-3 py-3">
                  <BookOpen className="h-4 w-4 text-[var(--course-text-faint)]" />
                  <dt className="text-[var(--course-text-muted)]">Lessons</dt>
                  <dd className="ml-auto font-medium text-[var(--course-text)]">{totalLessons}</dd>
                </div>
                <div className="flex items-center gap-3 py-3">
                  <UsersRound className="h-4 w-4 text-[var(--course-text-faint)]" />
                  <dt className="text-[var(--course-text-muted)]">Learners</dt>
                  <dd className="ml-auto font-medium text-[var(--course-text)]">{course._count.enrollments}</dd>
                </div>
                {classrooms.length > 0 ? (
                  <div className="flex items-start gap-3 py-3">
                    <School className="mt-0.5 h-4 w-4 text-[var(--course-text-faint)]" />
                    <dt className="text-[var(--course-text-muted)]">Classroom</dt>
                    <dd className="ml-auto max-w-40 text-right font-medium text-[var(--course-text)]">{classrooms.map((classroom) => classroom.name).join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {isEnrolled && progress === 100 ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--course-line)] bg-[var(--course-accent)] p-4 text-sm text-[var(--course-text)]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1"><strong className="font-semibold">Course completed.</strong> You can revisit any lesson at any time.</span>
                <CourseRatingButton courseId={courseId} courseTitle={course.title} />
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
