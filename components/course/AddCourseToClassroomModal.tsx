"use client";

import { useEffect, useState } from "react";
import { BookOpen, LockKeyhole, Search, School } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { ClassroomDestinationSelect } from "@/components/course/ClassroomDestinationSelect";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { CourseSummary } from "@/lib/course-summary";
import { cn } from "@/lib/utils";

type CourseSource = "my" | "all";
type Classroom = { id: string; name: string; role: string };

interface AddCourseToClassroomModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export function AddCourseToClassroomModal({ open, onClose, onAdded }: AddCourseToClassroomModalProps) {
  const [source, setSource] = useState<CourseSource>("my");
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [courseId, setCourseId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/classrooms")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: Classroom[]) => {
        if (cancelled) return;
        const teachable = data.filter((classroom) => classroom.role !== "STUDENT");
        setClassrooms(teachable);
        setClassroomId((current) => current || teachable[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) {
          setClassrooms([]);
          setClassroomId("");
          toast.error("Classrooms could not be loaded.");
        }
      });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const params = new URLSearchParams({ source });
        if (search.trim()) params.set("search", search.trim());
        const response = await fetch(`/api/courses?${params}`);
        if (!response.ok) throw new Error();
        setCourses(await response.json());
      } catch {
        setCourses([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, search, source]);

  const addCourse = async () => {
    if (!courseId || !classroomId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error ?? "The course could not be added.");
        return;
      }
      toast.success("Course added to Classroom.");
      setCourseId("");
      onAdded?.();
      onClose();
    } catch {
      toast.error("The course could not be added.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="course-dialog fixed bottom-0 left-0 top-auto flex max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-3xl border border-[var(--course-line-strong)] bg-white p-0 shadow-2xl md:left-[50%] md:top-[50%] md:max-h-[760px] md:max-w-2xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl">
        <div className="border-b border-[var(--course-line)] px-5 py-4 pr-12">
          <DialogTitle className="text-lg font-semibold text-[var(--course-text)]">Add to classroom</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-[var(--course-text-muted)]">Choose where the course should appear.</DialogDescription>
        </div>

        <div className="course-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-[var(--course-text-muted)]">Destination classroom</span>
              <ClassroomDestinationSelect classrooms={classrooms} value={classroomId} onChange={setClassroomId} />
              {!classrooms.length && <span className="mt-1.5 block text-xs text-[var(--course-text-muted)]">You need a Classroom where you are a teacher or teaching assistant.</span>}
            </div>

            <WorkspaceTabs
              ariaLabel="Course source"
              value={source}
              onValueChange={(tab) => { setSource(tab); setCourseId(""); }}
              items={[{ value: "my", label: "My courses" }, { value: "all", label: "Available courses" }] satisfies Array<{ value: CourseSource; label: string }>}
              size="compact"
              fill
            />

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--course-text-faint)]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, description, or creator" aria-label="Search available courses" className="h-10 w-full rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] pl-9 pr-3 text-sm text-[var(--course-text)] outline-none placeholder:text-[var(--course-text-faint)] focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" />
            </label>

            <div className="min-h-56 space-y-2">
              {loading ? (
                <div className="flex min-h-56 items-center justify-center"><Spinner className="h-5 w-5" /></div>
              ) : loadError ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-5 text-center"><p className="text-sm font-semibold text-[var(--course-text)]">Courses could not be loaded</p><p className="mt-1 text-xs text-[var(--course-text-muted)]">Change the search to try again.</p></div>
              ) : courses.length ? courses.map((course) => {
                const disabled = course.visibility === "PRIVATE";
                const selected = courseId === course.id;
                return (
                  <button key={course.id} type="button" onClick={() => setCourseId(course.id)} disabled={disabled} aria-pressed={selected} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-border)]", selected ? "border-[var(--course-focus-border)] bg-[var(--course-accent)]" : "border-[var(--course-line)] bg-white hover:bg-[var(--course-surface-muted)]", disabled && "cursor-not-allowed opacity-55")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--course-surface-muted)]">{disabled ? <LockKeyhole className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--course-text)]">{course.title}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--course-text-muted)]">{course.creator.name || "Unknown creator"} · {course._count.modules} modules · {course.visibility === "INVITATION_ONLY" ? "Invitation only" : course.visibility.toLocaleLowerCase()}</span>{disabled && <span className="mt-1 block text-[10px] font-medium text-[var(--course-text-muted)]">Change this course to Public or Invitation only before assigning it.</span>}</span>
                  </button>
                );
              }) : (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-5 text-center"><School className="mb-3 h-5 w-5 text-[var(--course-text-faint)]" /><p className="text-sm font-semibold text-[var(--course-text)]">No matching courses</p><p className="mt-1 text-xs text-[var(--course-text-muted)]">Try another search or source.</p></div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-[var(--course-line)] bg-white px-5 py-4">
          <WorkspaceButton type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={() => void addCourse()} disabled={saving || !courseId || !classroomId} className="flex-1">{saving ? "Adding…" : "Add course"}</WorkspaceButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
