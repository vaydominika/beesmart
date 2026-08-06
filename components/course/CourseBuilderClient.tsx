"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CloudOff, CloudUpload, Eye, EyeOff, Globe2, Lock, Mail, Menu, Send, ShieldCheck, X } from "lucide-react";
import CourseBuilderSidebar from "./CourseBuilderSidebar";
import CourseBuilderEditor from "./CourseBuilderEditor";
import { CourseInviteButton } from "./CourseInviteButton";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import {
  CourseBuilderCourse,
  CourseBuilderLesson,
  CourseBuilderUpdate,
  findLesson,
  lessonCount,
  updateLesson,
} from "@/lib/course-builder";
import { cn } from "@/lib/utils";
import type { CourseVisibility } from "@/lib/course-summary";
import { CourseAuditDialog } from "./CourseAuditDialog";

interface CourseBuilderClientProps {
  initialCourse: CourseBuilderCourse;
}

const VISIBILITY_OPTIONS: { value: CourseVisibility; label: string; icon: typeof Lock }[] = [
  { value: "PRIVATE", label: "Private", icon: Lock },
  { value: "PUBLIC", label: "Public", icon: Globe2 },
  { value: "INVITATION_ONLY", label: "Invitation only", icon: Mail },
];

function CourseVisibilityMenu({ value, onChange }: { value: CourseVisibility; onChange: (value: CourseVisibility) => void }) {
  return (
    <WorkspaceSelect
      ariaLabel="Course visibility"
      value={value}
      options={VISIBILITY_OPTIONS}
      onValueChange={onChange}
      size="compact"
      className="shrink-0 border-transparent bg-transparent font-semibold"
      contentClassName="w-44"
    />
  );
}

export default function CourseBuilderClient({ initialCourse }: CourseBuilderClientProps) {
  const [course, setCourse] = useState(initialCourse);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoPublish, setAutoPublish] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(initialCourse.modules[0]?.lessons[0]?.id ?? null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [courseTitle, setCourseTitle] = useState(initialCourse.title);
  const [mobileSyllabusOpen, setMobileSyllabusOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const activeLesson = findLesson(course, activeLessonId);
  const totalLessons = lessonCount(course);
  const hasUnpublishedChanges = Boolean(activeLesson && (activeLesson.contentDraft ?? activeLesson.content ?? "") !== (activeLesson.content ?? ""));

  const handleDataChange = (newCourseData: Partial<CourseBuilderCourse>) => {
    setCourse((current) => ({ ...current, ...newCourseData }));
  };

  const handleCourseUpdate = async (updates: CourseBuilderUpdate) => {
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json() as Partial<CourseBuilderCourse>;
      setCourse((current) => ({ ...current, ...updated }));
      return true;
    } catch {
      toast.error("Course changes could not be saved.");
      return false;
    }
  };

  const handleVisibilityChange = async (visibility: CourseVisibility) => {
    const previousVisibility = course.visibility;
    setCourse((current) => ({ ...current, visibility }));
    const saved = await handleCourseUpdate({ visibility });
    if (!saved) setCourse((current) => ({ ...current, visibility: previousVisibility }));
  };

  const commitCourseTitle = () => {
    const nextTitle = courseTitle.trim();
    setIsEditingTitle(false);
    if (!nextTitle) {
      setCourseTitle(course.title);
      return;
    }
    if (nextTitle !== course.title) void handleCourseUpdate({ title: nextTitle });
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !course.published }),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json() as Partial<CourseBuilderCourse>;
      setCourse((current) => ({ ...current, ...updated }));
      toast.success(updated.published ? "Course published." : "Course moved to drafts.");
    } catch {
      toast.error("Course status could not be updated.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishLesson = async () => {
    if (!activeLesson) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/courses/${course.id}/modules/${activeLesson.moduleId}/lessons/${activeLesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishNow: true }),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json() as CourseBuilderLesson;
      setCourse((current) => updateLesson(current, updated));
      toast.success("Lesson changes published.");
    } catch {
      toast.error("Lesson changes could not be published.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectLesson = (lessonId: string) => {
    if (isSaving) return;
    setActiveLessonId(lessonId);
    setMobileSyllabusOpen(false);
  };

  const syllabus = (
    <CourseBuilderSidebar
      course={course}
      onCourseChange={handleDataChange}
      activeLessonId={activeLessonId}
      onSelectLesson={selectLesson}
      isSaving={isSaving}
    />
  );

  return (
    <div className="course-builder flex h-full min-h-0 w-full bg-white text-[var(--course-text)]">
      {!previewMode && <aside className="hidden h-full w-[298px] shrink-0 border-r border-[var(--course-line)] bg-white lg:block">{syllabus}</aside>}

      {!previewMode && mobileSyllabusOpen && (
        <>
          <button type="button" aria-label="Close syllabus" onClick={() => setMobileSyllabusOpen(false)} className="fixed inset-0 z-40 bg-black/20 lg:hidden" />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,330px)] border-r border-[var(--course-line)] bg-white shadow-2xl lg:hidden">
            <WorkspaceButton type="button" variant="ghost" size="icon" onClick={() => setMobileSyllabusOpen(false)} aria-label="Close syllabus" className="absolute right-3 top-3 z-10"><X className="h-4 w-4" /></WorkspaceButton>
            {syllabus}
          </aside>
        </>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="h-[76px] shrink-0 border-b border-[var(--course-line)] bg-white">
          <div className="flex h-full items-center gap-2 px-3 md:px-5">
            {!previewMode && (
              <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => setMobileSyllabusOpen(true)} aria-label="Open syllabus" className="lg:hidden"><Menu className="h-4 w-4" /></WorkspaceButton>
            )}
            <WorkspaceButton asChild variant="secondary" size="icon" className="hidden sm:inline-flex"><Link href="/courses" aria-label="Back to courses"><ArrowLeft className="h-4 w-4" /></Link></WorkspaceButton>

            <div className="min-w-0 flex-1">
              {isEditingTitle && !previewMode ? (
                <input
                  autoFocus
                  value={courseTitle}
                  aria-label="Course title"
                  onChange={(event) => setCourseTitle(event.target.value)}
                  onBlur={commitCourseTitle}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitCourseTitle();
                    if (event.key === "Escape") { setCourseTitle(course.title); setIsEditingTitle(false); }
                  }}
                  className="h-7 w-full max-w-md rounded-md border border-[var(--course-focus-border)] bg-[var(--course-surface-muted)] px-2 text-base font-semibold outline-none ring-2 ring-[var(--course-focus-ring)]"
                />
              ) : (
                <button type="button" onClick={() => !previewMode && setIsEditingTitle(true)} className="block max-w-full truncate text-left text-base font-semibold tracking-[-0.02em] hover:text-[var(--course-text-muted)]" title={previewMode ? undefined : "Rename course"}>{course.title}</button>
              )}

              <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-[var(--course-text-muted)]">
                {!previewMode && (
                  <CourseVisibilityMenu value={course.visibility ?? (course.isPublic ? "PUBLIC" : "PRIVATE")} onChange={(visibility) => void handleVisibilityChange(visibility)} />
                )}
                <span>{course.published ? "Published" : "Draft"}</span><span aria-hidden="true">/</span><span className="truncate">{course.modules.length} modules / {totalLessons} lessons</span>
                {!previewMode && course.visibility === "INVITATION_ONLY" && <CourseInviteButton courseId={course.id} />}
              </div>
            </div>

            {!previewMode && (
              <div className="flex shrink-0 items-center gap-1.5">
                {isSaving && <span role="status" className="hidden text-[10px] font-medium text-[var(--course-text-muted)] sm:inline">Saving...</span>}
                <span className="hidden text-[11px] text-[var(--course-text-muted)] xl:inline">Auto-publish lesson</span>
                <button type="button" role="switch" aria-checked={autoPublish} aria-label="Publish lesson edits automatically" onClick={() => setAutoPublish((current) => !current)} className={cn("relative h-5 w-9 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-border)]", autoPublish ? "border-[var(--course-focus-border)] bg-[var(--course-accent)]" : "border-[var(--course-line-strong)] bg-[var(--course-surface-muted)]")}>
                  <span data-switch-thumb className={cn("absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform", autoPublish ? "translate-x-4" : "translate-x-0")} />
                </button>
                {!autoPublish && (
                  <WorkspaceButton type="button" variant="secondary" size="compact" aria-label="Publish lesson" onClick={() => void handlePublishLesson()} disabled={isSaving || !hasUnpublishedChanges}><Send className="h-3.5 w-3.5" /><span className="hidden lg:inline">Publish lesson</span></WorkspaceButton>
                )}
              </div>
            )}

            {!previewMode && <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => setAuditOpen(true)}><ShieldCheck className="h-3.5 w-3.5" /><span className="hidden xl:inline">Audit course</span></WorkspaceButton>}

            <WorkspaceButton type="button" variant={previewMode ? "primary" : "secondary"} size="compact" onClick={() => setPreviewMode((current) => !current)}>
              {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{previewMode ? "Exit preview" : "Preview"}</span>
            </WorkspaceButton>
            <WorkspaceButton type="button" variant={course.published ? "secondary" : "primary"} size="compact" onClick={() => void handlePublish()} disabled={isPublishing || isSaving}>
              {course.published ? <CloudOff className="h-3.5 w-3.5" /> : <CloudUpload className="h-3.5 w-3.5" />}<span>{isPublishing ? "Updating..." : course.published ? "Unpublish" : "Publish"}</span>
            </WorkspaceButton>
          </div>
        </header>

        <main className="course-scroll min-h-0 flex-1 overflow-y-auto bg-[var(--course-canvas)] lg:rounded-tl-[20px]">
          {activeLesson ? (
            <div className={cn("mx-auto w-full px-4 py-5 md:px-7 md:py-7", previewMode ? "max-w-4xl" : "max-w-5xl")}>
              <CourseBuilderEditor lesson={activeLesson} courseId={course.id} previewMode={previewMode} autoPublish={autoPublish} onSavingChange={setIsSaving} onLessonUpdate={(updatedLesson) => setCourse((current) => updateLesson(current, updatedLesson))} />
            </div>
          ) : (
            <div className="flex h-full min-h-96 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--course-accent)]"><BookOpen className="h-5 w-5" /></div>
              <h2 className="text-lg font-semibold">Your first lesson starts in the syllabus</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--course-text-muted)]">Add a module, then create a lesson to begin writing course material.</p>
              <WorkspaceButton type="button" variant="secondary" onClick={() => setMobileSyllabusOpen(true)} className="mt-5 lg:hidden">Open syllabus</WorkspaceButton>
            </div>
          )}
        </main>
      </section>
      <CourseAuditDialog open={auditOpen} onOpenChange={setAuditOpen} courseId={course.id} onSelectLesson={selectLesson} />
    </div>
  );
}
