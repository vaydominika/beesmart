"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CloudOff, CloudUpload, Eye, EyeOff, Globe2, Lightbulb, Loader2, Lock, Mail, Menu, Pencil, Save, ShieldCheck, X } from "lucide-react";
import CourseBuilderSidebar from "./CourseBuilderSidebar";
import CourseBuilderEditor from "./CourseBuilderEditor";
import type { CourseBuilderEditorHandle } from "./CourseBuilderEditor";
import { CourseCreationTutorial } from "./CourseCreationTutorial";
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
import type { CoursePublishIssue } from "@/lib/course-audit";
import { COURSE_TITLE_MAX_LENGTH, displayCourseTitle } from "@/lib/course-title";
import { Dialog, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceDialogContent } from "@/components/ui/workspace-dialog";

interface CourseBuilderClientProps {
  initialCourse: CourseBuilderCourse;
}

function courseDraftFingerprint(course: CourseBuilderCourse, title = course.title) {
  return JSON.stringify({
    title: title.trim(),
    visibility: course.visibility,
    modules: course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      order: module.order,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        moduleId: lesson.moduleId,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        contentDraft: lesson.contentDraft,
        order: lesson.order,
        isLocked: lesson.isLocked,
        files: lesson.files?.map((file) => ({ id: file.id, isVisible: file.isVisible })) ?? [],
      })),
    })),
  });
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
  const [savedCourse, setSavedCourse] = useState(initialCourse);
  const editorRef = useRef<CourseBuilderEditorHandle>(null);
  const saveInProgressRef = useRef(false);
  const savedLessonDuringSaveRef = useRef<CourseBuilderLesson | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [hasUnsavedLessonChanges, setHasUnsavedLessonChanges] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(initialCourse.modules[0]?.lessons[0]?.id ?? null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [courseTitle, setCourseTitle] = useState(initialCourse.title);
  const [mobileSyllabusOpen, setMobileSyllabusOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [publishCheckOpen, setPublishCheckOpen] = useState(false);
  const [publishIssues, setPublishIssues] = useState<CoursePublishIssue[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);

  const activeLesson = findLesson(course, activeLessonId);
  const totalLessons = lessonCount(course);
  const hasUnsavedCourseChanges = courseDraftFingerprint(course, courseTitle) !== courseDraftFingerprint(savedCourse);
  const hasUnsavedChanges = hasUnsavedCourseChanges || hasUnsavedLessonChanges;
  const hasUnpublishedChanges = course.modules.some((module) => module.lessons.some((lesson) =>
    (lesson.contentDraft ?? lesson.content ?? "") !== (lesson.content ?? ""),
  ));

  const handleDataChange = (newCourseData: Partial<CourseBuilderCourse>) => {
    setCourse((current) => ({ ...current, ...newCourseData }));
  };

  const handleLessonDirtyChange = useCallback((dirty: boolean) => {
    setHasUnsavedLessonChanges(dirty);
  }, []);

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
      return updated;
    } catch {
      toast.error("Course changes could not be saved.");
      return null;
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
    setCourseTitle(nextTitle);
    if (nextTitle !== course.title) {
      setCourse((current) => ({ ...current, title: nextTitle }));
    }
  };

  const handleLessonUpdate = useCallback((updatedLesson: CourseBuilderLesson) => {
    if (saveInProgressRef.current) savedLessonDuringSaveRef.current = updatedLesson;
    setCourse((current) => updateLesson(current, updatedLesson));
  }, []);

  const handleSave = async () => {
    if (isSavingCourse || isPublishing) return false;
    saveInProgressRef.current = true;
    savedLessonDuringSaveRef.current = null;
    setIsSavingCourse(true);
    try {
      const lessonSaved = await editorRef.current?.save() ?? true;
      if (!lessonSaved) return false;

      const nextTitle = courseTitle.trim() || course.title;
      const courseUpdate = await handleCourseUpdate({ title: nextTitle, visibility: course.visibility });
      if (!courseUpdate) return false;

      const courseWithSavedLesson = savedLessonDuringSaveRef.current
        ? updateLesson(course, savedLessonDuringSaveRef.current)
        : course;
      setSavedCourse({ ...courseWithSavedLesson, ...courseUpdate, title: nextTitle, visibility: course.visibility });

      setCourseTitle(nextTitle);
      setHasUnsavedLessonChanges(false);
      toast.success("Course saved.");
      return true;
    } finally {
      saveInProgressRef.current = false;
      savedLessonDuringSaveRef.current = null;
      setIsSavingCourse(false);
    }
  };

  const handlePublish = async () => {
    const wasPublished = course.published;
    setIsPublishing(true);
    setPublishIssues([]);
    setPublishError(null);
    setPublishCheckOpen(true);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      const result = await response.json().catch(() => ({})) as Partial<CourseBuilderCourse> & { error?: string; code?: string; issues?: CoursePublishIssue[] };
      if (!response.ok) {
        if (result.code === "COURSE_NOT_PUBLISHABLE") setPublishIssues(result.issues ?? []);
        else setPublishError(result.error ?? "The publishing safety check could not be completed.");
        return;
      }
      setCourse((current) => ({
        ...current,
        ...result,
        modules: current.modules.map((module) => ({
          ...module,
          lessons: module.lessons.map((lesson) => ({
            ...lesson,
            content: lesson.contentDraft ?? lesson.content,
          })),
        })),
      }));
      setPublishCheckOpen(false);
      toast.success(wasPublished ? "Course changes published." : "Course published.");
    } catch {
      setPublishError("The publishing safety check could not be completed.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json() as Partial<CourseBuilderCourse>;
      setCourse((current) => ({ ...current, ...updated }));
      toast.success("Course moved to drafts.");
    } catch {
      toast.error("Course status could not be updated.");
    } finally {
      setIsPublishing(false);
    }
  };

  const selectLesson = (lessonId: string | null) => {
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
      isSaving={isSaving || isSavingCourse}
    />
  );

  return (
    <div className="course-builder flex h-full min-h-0 w-full bg-[var(--app-surface)] text-[var(--course-text)]">
      {!previewMode && <aside className="hidden h-full w-[298px] shrink-0 border-r border-[var(--course-line)] bg-[var(--app-surface)] lg:block">{syllabus}</aside>}

      {!previewMode && mobileSyllabusOpen && (
        <>
          <button type="button" aria-label="Close syllabus" onClick={() => setMobileSyllabusOpen(false)} className="fixed inset-0 z-40 bg-[var(--app-scrim-soft)] lg:hidden" />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,330px)] border-r border-[var(--course-line)] bg-[var(--app-surface)] shadow-2xl lg:hidden">
            <WorkspaceButton type="button" variant="ghost" size="icon" onClick={() => setMobileSyllabusOpen(false)} aria-label="Close syllabus" className="absolute right-3 top-3 z-10"><X className="h-4 w-4" /></WorkspaceButton>
            {syllabus}
          </aside>
        </>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="h-[76px] shrink-0 border-b border-[var(--course-line)] bg-[var(--app-surface)]">
          <div className="flex h-full items-center gap-2 px-3 md:px-5">
            {!previewMode && (
              <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => setMobileSyllabusOpen(true)} aria-label="Open syllabus" className="lg:hidden"><Menu className="h-4 w-4" /></WorkspaceButton>
            )}
            <WorkspaceButton asChild variant="secondary" size="icon" className="hidden sm:inline-flex"><Link href="/courses" aria-label="Back to courses"><ArrowLeft className="h-4 w-4" /></Link></WorkspaceButton>

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <div className="flex h-8 min-w-0 shrink items-center gap-1.5">
                {isEditingTitle && !previewMode ? (
                  <input
                    autoFocus
                    value={courseTitle}
                    aria-label="Course title"
                    maxLength={COURSE_TITLE_MAX_LENGTH}
                    onChange={(event) => setCourseTitle(event.target.value)}
                    onBlur={commitCourseTitle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitCourseTitle();
                      if (event.key === "Escape") { setCourseTitle(course.title); setIsEditingTitle(false); }
                    }}
                    className="h-8 min-w-[1ch] max-w-[min(45ch,40vw)] border-0 bg-transparent px-2 text-base font-semibold outline-none [field-sizing:content]"
                  />
                ) : (
                  <button type="button" onClick={() => !previewMode && setIsEditingTitle(true)} aria-label={course.title} className="flex h-8 min-w-0 max-w-[min(45ch,40vw)] items-center rounded-lg px-2 text-left text-base font-semibold tracking-[-0.02em] outline-none transition-colors hover:bg-[var(--course-surface-muted)] hover:text-[var(--course-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--course-focus-ring)]" title={previewMode ? course.title : `Rename course: ${course.title}`}>
                    <span className="truncate" aria-hidden="true">{displayCourseTitle(course.title)}</span>
                  </button>
                )}
                {!previewMode && <Pencil className="h-3.5 w-3.5 shrink-0 text-[var(--course-text-muted)]" aria-hidden="true" />}
              </div>

              <div className="-mt-1 flex h-8 min-w-0 items-center gap-2">
                {!previewMode && (
                  <CourseVisibilityMenu value={course.visibility ?? (course.isPublic ? "PUBLIC" : "PRIVATE")} onChange={(visibility) => void handleVisibilityChange(visibility)} />
                )}
                <div className="hidden min-w-0 items-center gap-2 whitespace-nowrap text-[10px] text-[var(--course-text-muted)] sm:flex">
                  <span>{course.published ? hasUnpublishedChanges ? "Published · Unpublished changes" : "Published" : "Draft"}</span>
                  <span aria-hidden="true">/</span>
                  <span>{course.modules.length} modules / {totalLessons} lessons</span>
                </div>
                {!previewMode && course.visibility === "INVITATION_ONLY" && <CourseInviteButton courseId={course.id} />}
              </div>
            </div>

            {!previewMode && !isSaving && !isSavingCourse && hasUnsavedChanges && <span role="status" className="hidden shrink-0 text-[10px] font-medium text-[var(--course-text-muted)] sm:inline">Unsaved changes</span>}

            <WorkspaceButton type="button" variant="secondary" size="icon-compact" onClick={() => setTutorialOpen(true)} aria-label="Review course creation tutorial" title="Course creation tutorial">
              <Lightbulb className="h-3.5 w-3.5" />
            </WorkspaceButton>
            <WorkspaceButton type="button" variant={previewMode ? "primary" : "secondary"} size="compact" onClick={() => setPreviewMode((current) => !current)}>
              {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{previewMode ? "Exit preview" : "Preview"}</span>
            </WorkspaceButton>
            {!previewMode && <WorkspaceButton type="button" variant={hasUnsavedChanges ? "primary" : "secondary"} size="compact" onClick={() => void handleSave()} disabled={isPublishing || isSaving || isSavingCourse || !hasUnsavedChanges}>
              {isSaving || isSavingCourse ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}<span>{isSaving || isSavingCourse ? "Saving..." : "Save"}</span>
            </WorkspaceButton>}
            {course.published && <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void handleUnpublish()} disabled={isPublishing || isSaving || isSavingCourse || hasUnsavedChanges}><CloudOff className="h-3.5 w-3.5" /><span>Unpublish</span></WorkspaceButton>}
            {(!course.published || hasUnpublishedChanges) && <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => void handlePublish()} disabled={isPublishing || isSaving || isSavingCourse || hasUnsavedChanges} title={hasUnsavedChanges ? "Save changes before publishing" : undefined}>
              <CloudUpload className="h-3.5 w-3.5" /><span>{isPublishing ? "Checking..." : course.published ? "Publish changes" : "Publish"}</span>
            </WorkspaceButton>}
          </div>
        </header>

        <main className="course-scroll min-h-0 flex-1 overflow-y-auto bg-[var(--course-canvas)]">
          {activeLesson ? (
            <div className={cn("mx-auto w-full p-4 md:p-6", previewMode ? "max-w-4xl" : "max-w-5xl")}>
              <CourseBuilderEditor ref={editorRef} lesson={activeLesson} courseId={course.id} previewMode={previewMode} onDirtyChange={handleLessonDirtyChange} onSavingChange={setIsSaving} onLessonUpdate={handleLessonUpdate} />
            </div>
          ) : (
            <div className="flex h-full min-h-96 flex-col items-center justify-center px-6 text-center">
              <h2 className="text-lg font-semibold">Your first lesson starts in the syllabus</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--course-text-muted)]">Add a module, then create a lesson to begin writing course material.</p>
              <WorkspaceButton type="button" variant="secondary" onClick={() => setMobileSyllabusOpen(true)} className="mt-5 lg:hidden">Open syllabus</WorkspaceButton>
            </div>
          )}
        </main>
      </section>
      <CourseCreationTutorial
        open={tutorialOpen}
        intent="review"
        onClose={() => setTutorialOpen(false)}
        onFinish={() => {
          setTutorialOpen(false);
          return true;
        }}
      />
      <PublishCheckDialog open={publishCheckOpen} checking={isPublishing} issues={publishIssues} error={publishError} onClose={() => setPublishCheckOpen(false)} />
    </div>
  );
}

function PublishCheckDialog({ open, checking, issues, error, onClose }: { open: boolean; checking: boolean; issues: CoursePublishIssue[]; error: string | null; onClose: () => void }) {
  const blocked = issues.length > 0;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !checking) onClose(); }}>
      <WorkspaceDialogContent mobileSheet={false} className="course-dialog w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--course-line-strong)] bg-[var(--app-surface)] p-0 shadow-2xl">
        <DialogClose asChild><WorkspaceButton type="button" variant="ghost" size="icon-compact" aria-label="Close publication safety check" className="absolute right-4 top-4 z-20" disabled={checking}><X className="h-4 w-4" /></WorkspaceButton></DialogClose>
        <div className="border-b border-[var(--course-line)] px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[var(--course-text)]"><ShieldCheck className="h-5 w-5" />Publication safety check</DialogTitle>
        </div>
        <div className="px-5 py-5">
          {checking ? (
            <div role="status" className="flex min-h-32 flex-col items-center justify-center text-center text-sm text-[var(--course-text-muted)]"><Loader2 className="mb-3 h-6 w-6 animate-spin" />Checking whether this course can be published…</div>
          ) : blocked ? (
            <div>
              <div className="flex gap-3 rounded-xl border border-[var(--app-warning-border)] bg-[var(--app-warning-soft)] p-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-sm font-semibold">Course not published</p><p className="mt-1 text-xs leading-5 text-[var(--course-text-muted)]">The safety check found {issues.length} publication {issues.length === 1 ? "blocker" : "blockers"}.</p></div></div>
              <ul className="mt-4 space-y-2">{issues.map((issue, index) => <li key={`${issue.category}-${index}`} className="rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] p-3"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--course-text-faint)]">{issue.category.replaceAll("_", " ")}</span><p className="mt-1 text-sm leading-5 text-[var(--course-text)]">{issue.reason}</p></li>)}</ul>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] p-3"><p className="text-sm font-semibold text-[var(--course-danger)]">Course not published</p><p className="mt-1 text-xs leading-5 text-[var(--course-text-muted)]">{error ?? "The publishing safety check could not be completed."}</p></div>
          )}
        </div>
        {!checking && <div className="flex justify-end border-t border-[var(--course-line)] px-5 py-4"><WorkspaceButton type="button" variant="secondary" onClick={onClose}>Close</WorkspaceButton></div>}
      </WorkspaceDialogContent>
    </Dialog>
  );
}
