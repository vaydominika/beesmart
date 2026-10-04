"use client";

import { useText } from "@/i18n/use-text";

import { useEffect, useState } from "react";
import { ClipboardList, GraduationCap } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
} from "@/components/ui/workspace-dialog";
import { WorkspaceSwitchRow } from "@/components/ui/workspace-switch-row";
import { localDateInputValue, minimumLocalDateTimeInputValue, minimumLocalTimeInputValue } from "@/lib/schedule-validation";
import type { ScheduleEvent } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type AssignmentDetails = {
  title: string;
  description?: string | null;
  deadlineAt: string;
  deadlineTimeZone: string;
  deadlineHasTime: boolean;
  isGraded: boolean;
  maxPoints?: number | null;
};

type TestDetails = {
  title: string;
  description?: string | null;
  type: "TEST" | "EXAM";
  timeLimit?: number | null;
  passingScore?: number | null;
  opensAt?: string | null;
  closesAt?: string | null;
  maxAttempts: number;
};

type ClassroomWorkEvent = ScheduleEvent & {
  classroomId: string;
  assignmentId?: string | null;
  testId?: string | null;
};

export type ClassroomWorkReference = Partial<ScheduleEvent> & {
  classroomId: string;
  assignmentId?: string | null;
  testId?: string | null;
};

interface ClassroomWorkEditModalProps {
  open: boolean;
  event: ClassroomWorkReference;
  onClose: () => void;
  onUpdated?: (event: ScheduleEvent) => void;
  onSaved?: () => void | Promise<void>;
  post?: { id: string };
}

export function isClassroomWorkEvent(event: ScheduleEvent): event is ClassroomWorkEvent {
  return Boolean(event.classroomId && (event.assignmentId || event.testId));
}

export type ClassroomWorkKind = "assignment" | "exam" | "test";

export function classroomWorkKind(event: Pick<ScheduleEvent, "assignmentId" | "testId" | "title">): ClassroomWorkKind | null {
  if (event.assignmentId) return "assignment";
  if (!event.testId) return null;
  return event.title.trim().toLowerCase().startsWith("exam:") ? "exam" : "test";
}

export function classroomWorkDeleteEndpoint(event: ScheduleEvent): string | null {
  if (!isClassroomWorkEvent(event)) return null;
  if (event.assignmentId) return `/api/classrooms/${event.classroomId}/assignments/${event.assignmentId}`;
  return `/api/classrooms/${event.classroomId}/tests/${event.testId}`;
}

function localDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function assignmentDeadlineInputs(details: AssignmentDetails) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: details.deadlineTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(details.deadlineAt)).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: details.deadlineHasTime ? `${parts.hour}:${parts.minute}` : "",
  };
}

export function ClassroomWorkEditModal({ open, event, onClose, onUpdated, onSaved, post }: ClassroomWorkEditModalProps) {
  const t = useText();
  const assignmentMode = Boolean(event.assignmentId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workType, setWorkType] = useState<"ASSIGNMENT" | "TEST" | "EXAM">(assignmentMode ? "ASSIGNMENT" : "TEST");

  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [isGraded, setIsGraded] = useState(true);
  const [maxPoints, setMaxPoints] = useState("100");
  const [originalDueDate, setOriginalDueDate] = useState("");
  const [originalDueTime, setOriginalDueTime] = useState("");

  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [originalOpensAt, setOriginalOpensAt] = useState("");
  const [originalClosesAt, setOriginalClosesAt] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const endpoint = assignmentMode
        ? `/api/classrooms/${event.classroomId}/assignments/${event.assignmentId}`
        : `/api/classrooms/${event.classroomId}/tests/${event.testId}`;
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Classroom work could not be loaded");
        if (cancelled) return;
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        if (assignmentMode) {
          const assignment = data as AssignmentDetails;
          const deadline = assignmentDeadlineInputs(assignment);
          setWorkType("ASSIGNMENT");
          setDueDate(deadline.date);
          setDueTime(deadline.time);
          setOriginalDueDate(deadline.date);
          setOriginalDueTime(deadline.time);
          setTimeZone(assignment.deadlineTimeZone);
          setIsGraded(assignment.isGraded);
          setMaxPoints(String(assignment.maxPoints ?? 100));
        } else {
          const test = data as TestDetails;
          const opening = localDateTimeInput(test.opensAt);
          const closing = localDateTimeInput(test.closesAt);
          setWorkType(test.type);
          setOpensAt(opening);
          setClosesAt(closing);
          setOriginalOpensAt(opening);
          setOriginalClosesAt(closing);
          setTimeLimit(test.timeLimit == null ? "" : String(test.timeLimit));
          setPassingScore(test.passingScore == null ? "" : String(test.passingScore));
          setMaxAttempts(String(test.maxAttempts ?? 1));
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Classroom work could not be loaded");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [assignmentMode, event.assignmentId, event.classroomId, event.testId, open]);

  const refreshEvent = async () => {
    if (!event.id || !onUpdated) return;
    const response = await fetch(`/api/user/events?id=${event.id}`, { cache: "no-store" });
    if (!response.ok) return;
    onUpdated(await response.json());
  };

  const save = async () => {
    if (!title.trim()) return toast.error(t("Title is required."));
    let endpoint: string;
    let body: Record<string, unknown>;

    if (assignmentMode) {
      if (!dueDate) return toast.error(t("Due date is required."));
      if (dueDate !== originalDueDate && dueDate < localDateInputValue()) return toast.error(t("Due date cannot be in the past."));
      if ((dueDate !== originalDueDate || dueTime !== originalDueTime) && dueDate === localDateInputValue() && dueTime && dueTime < minimumLocalTimeInputValue()) {
        return toast.error(t("Due time cannot be in the past."));
      }
      const points = Number(maxPoints);
      if (isGraded && (!Number.isFinite(points) || points < 0)) return toast.error(t("Maximum points must be zero or greater."));
      endpoint = `/api/classrooms/${event.classroomId}/assignments/${event.assignmentId}`;
      body = { title: title.trim(), description: description.trim() || null, dueDate, dueTime: dueTime || null, timeZone, isGraded, maxPoints: isGraded ? points : null };
    } else {
      if (opensAt && opensAt !== originalOpensAt && opensAt < minimumLocalDateTimeInputValue()) return toast.error(t("Opening time cannot be in the past."));
      if (closesAt !== originalClosesAt && closesAt && closesAt < minimumLocalDateTimeInputValue()) return toast.error(t("Closing time cannot be in the past."));
      if (closesAt && closesAt < opensAt) return toast.error(t("Closing time must be after opening time."));
      const attempts = Number(maxAttempts);
      if (!Number.isSafeInteger(attempts) || attempts < 1) return toast.error(t("Attempts allowed must be a positive integer."));
      const minutes = timeLimit ? Number(timeLimit) : null;
      const passing = passingScore ? Number(passingScore) : null;
      if (minutes != null && (!Number.isFinite(minutes) || minutes < 1)) return toast.error(t("Time limit must be at least one minute."));
      if (passing != null && (!Number.isFinite(passing) || passing < 0 || passing > 100)) return toast.error(t("Passing score must be between 0 and 100."));
      endpoint = `/api/classrooms/${event.classroomId}/tests/${event.testId}`;
      body = { title: title.trim(), description: description.trim() || null, type: workType, opensAt: opensAt ? new Date(opensAt).toISOString() : null, closesAt: closesAt ? new Date(closesAt).toISOString() : null, timeLimit: minutes, passingScore: passing, maxAttempts: attempts };
    }

    setSaving(true);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `${workType === "ASSIGNMENT" ? "Assignment" : workType === "EXAM" ? "Exam" : "Test"} could not be updated`);
      await refreshEvent();
      await onSaved?.();
      toast.success(t(post ? "Post updated." : `${workType === "ASSIGNMENT" ? "Assignment" : workType === "EXAM" ? "Exam" : "Test"} updated.`));
      onClose();
    } catch (error) {
      toast.error(t(error instanceof Error ? error.message : "Changes could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const label = workType === "ASSIGNMENT" ? "assignment" : workType === "EXAM" ? "exam" : "test";
  const WorkIcon = assignmentMode ? ClipboardList : GraduationCap;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <WorkspaceDialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-hidden p-0">
        <WorkspaceDialogHeader className="border-b border-[var(--app-border)] px-5 py-4 pr-14">
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <WorkIcon className="h-5 w-5" aria-hidden="true" />
            {post ? t("Edit post") : t("Edit {v0}", { v0: label })}
          </WorkspaceDialogTitle>
        </WorkspaceDialogHeader>

        <WorkspaceDialogBody className="max-h-[calc(100dvh-11rem)] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center"><Spinner /></div>
          ) : loadError ? (
            <div className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] p-4 text-sm text-[var(--app-danger)]">{loadError}</div>
          ) : (
            <div className="space-y-4">
              {post && <p className="text-xs font-semibold text-[var(--app-text-muted)]">{workType === "ASSIGNMENT" ? t("Assignment") : workType === "EXAM" ? t("Exam") : t("Test")}  {t("details")}</p>}
              <Field label={t("Title")} value={title} onChange={setTitle} autoFocus />
              <label className="block">
                <span className={workspaceLabelClass}>{t("Description")}</span>
                <textarea value={description} onChange={(changeEvent) => setDescription(changeEvent.target.value)} rows={3} className={`${workspaceFieldClass} h-auto min-h-24 w-full resize-y py-2.5`} placeholder={assignmentMode ? t("Instructions for students") : t("What this assessment covers")} />
              </label>

              {assignmentMode ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("Due date")} type="date" min={originalDueDate < localDateInputValue() ? originalDueDate : localDateInputValue()} value={dueDate} onChange={setDueDate} />
                    <Field label={t("Due time")} type="time" min={dueDate === localDateInputValue() && dueDate !== originalDueDate ? minimumLocalTimeInputValue() : undefined} value={dueTime} onChange={setDueTime} />
                  </div>
                  <p className="-mt-2 text-xs text-[var(--app-text-faint)]">{t("Timezone:")} {timeZone}{t(". Without a time, work is due at 23:59.")}</p>
                  <div className="grid items-end gap-3 sm:grid-cols-[1fr_9rem]">
                    <WorkspaceSwitchRow id="work-edit-graded" label={t("Graded assignment")} checked={isGraded} onCheckedChange={setIsGraded} className="h-10 rounded-xl px-3 py-0" />
                    {isGraded ? <Field label={t("Maximum points")} type="number" min="0" value={maxPoints} onChange={setMaxPoints} /> : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("Opens (optional)")} type="datetime-local" min={originalOpensAt && originalOpensAt < minimumLocalDateTimeInputValue() ? originalOpensAt : minimumLocalDateTimeInputValue()} value={opensAt} onChange={setOpensAt} />
                    <Field label={t("Closes (optional)")} type="datetime-local" min={opensAt || minimumLocalDateTimeInputValue()} value={closesAt} onChange={setClosesAt} />
                  </div>
                  <p className="-mt-2 text-xs text-[var(--app-text-faint)]">{t("Leave these blank to make the assessment available immediately with no closing deadline.")}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t("Time limit (min)")} type="number" min="1" value={timeLimit} onChange={setTimeLimit} placeholder={t("None")} />
                    <Field label={t("Passing score (%)")} type="number" min="0" max="100" value={passingScore} onChange={setPassingScore} placeholder={t("None")} />
                    <Field label={t("Attempts allowed")} type="number" min="1" value={maxAttempts} onChange={setMaxAttempts} />
                  </div>
                </>
              )}
            </div>
          )}
        </WorkspaceDialogBody>

        <WorkspaceDialogFooter className="border-t border-[var(--app-border)] px-5 py-3">
          <WorkspaceButton type="button" variant="secondary" onClick={onClose} disabled={saving}>{t("Cancel")}</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={() => void save()} disabled={loading || Boolean(loadError) || saving}>
            {saving ? <><Spinner className="h-4 w-4" />{t("Saving…")}</> : post ? t("Save post") : t("Save {v0}", { v0: label })}
          </WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", min, max, placeholder, autoFocus }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; max?: string; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className={workspaceLabelClass}>{label}</span>
      <Input type={type} min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} className={cn(workspaceFieldClass, "w-full")} />
    </label>
  );
}
