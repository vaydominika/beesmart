"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Clock, GraduationCap, RotateCcw, Target } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
} from "@/components/ui/workspace-dialog";
import { WorkspaceButton, workspaceButtonVariants } from "@/components/ui/workspace-button";
import { WorkspaceLoadingState } from "@/components/ui/workspace-state";
import { WorkspaceFormMessage } from "@/components/ui/workspace-form-message";
import { readAcceptedAnswers } from "@/lib/test-scoring";
import { cn } from "@/lib/utils";

type PreviewQuestion = {
  id: string;
  questionText: string;
  questionType: string;
  points: number;
  acceptedAnswers: unknown;
  options: Array<{ id: string; optionText: string; isCorrect: boolean }>;
};

type PreviewTest = {
  id: string;
  title: string;
  description?: string | null;
  type: "TEST" | "EXAM";
  timeLimit?: number | null;
  passingScore?: number | null;
  opensAt?: string | null;
  closesAt?: string | null;
  maxAttempts: number;
  questions: PreviewQuestion[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  classroomId: string;
  testId: string | null;
};

const questionTypeLabel = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const formatSchedule = (value?: string | null) => value ? new Date(value).toLocaleString() : "Not set";

export function TestPreviewModal({ open, onClose, classroomId, testId }: Props) {
  const [result, setResult] = useState<{ testId: string | null; test: PreviewTest | null; error: string | null }>({
    testId: null,
    test: null,
    error: null,
  });
  const resultIsCurrent = Boolean(testId && result.testId === testId);
  const test = resultIsCurrent ? result.test : null;
  const error = resultIsCurrent ? result.error : null;
  const loading = Boolean(open && testId && !resultIsCurrent);

  useEffect(() => {
    if (!open || !testId) return;
    const controller = new AbortController();

    void fetch(`/api/classrooms/${classroomId}/tests/${testId}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Assessment preview could not be loaded");
        setResult({ testId, test: result as PreviewTest, error: null });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setResult({
          testId,
          test: null,
          error: cause instanceof Error ? cause.message : "Assessment preview could not be loaded",
        });
      });

    return () => controller.abort();
  }, [classroomId, open, testId]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <WorkspaceDialogContent className="classroom-dialog max-w-3xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {test?.title || "Assessment preview"}
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>
            Review the assessment exactly as configured before opening its grading dashboard.
          </WorkspaceDialogDescription>
        </WorkspaceDialogHeader>

        <WorkspaceDialogBody>
          {loading ? <WorkspaceLoadingState className="py-16" label="Loading assessment" /> : null}
          {error ? <WorkspaceFormMessage>{error}</WorkspaceFormMessage> : null}
          {test ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--classroom-text-muted)]">
                <span className="rounded-full bg-[var(--classroom-accent)] px-3 py-1 uppercase text-[var(--classroom-text)]">{test.type}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--classroom-surface-muted)] px-3 py-1"><Clock className="h-3.5 w-3.5" />{test.timeLimit ? `${test.timeLimit} minutes` : "No time limit"}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--classroom-surface-muted)] px-3 py-1"><Target className="h-3.5 w-3.5" />{test.passingScore ?? 50}% to pass</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--classroom-surface-muted)] px-3 py-1"><RotateCcw className="h-3.5 w-3.5" />{test.maxAttempts} {test.maxAttempts === 1 ? "attempt" : "attempts"}</span>
              </div>

              {test.description ? <div className="prose prose-sm max-w-none text-[var(--classroom-text-muted)]" dangerouslySetInnerHTML={{ __html: test.description }} /> : null}

              <div className="grid gap-2 text-xs text-[var(--classroom-text-muted)] sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] p-3"><span className="mb-1 flex items-center gap-1 font-semibold text-[var(--classroom-text)]"><CalendarDays className="h-3.5 w-3.5" />Opens</span>{formatSchedule(test.opensAt)}</div>
                <div className="rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] p-3"><span className="mb-1 flex items-center gap-1 font-semibold text-[var(--classroom-text)]"><CalendarDays className="h-3.5 w-3.5" />Closes</span>{formatSchedule(test.closesAt)}</div>
              </div>

              <section aria-labelledby="preview-questions-heading">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 id="preview-questions-heading" className="text-sm font-semibold text-[var(--classroom-text)]">Questions</h3>
                  <span className="text-xs font-medium text-[var(--classroom-text-muted)]">{test.questions.length} total</span>
                </div>
                <ol className="space-y-3">
                  {test.questions.map((question, index) => {
                    const acceptedAnswers = readAcceptedAnswers(question.acceptedAnswers);
                    return (
                      <li key={question.id} className="rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--classroom-accent)] text-xs font-bold text-[var(--classroom-text)]">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-5 text-[var(--classroom-text)]">{question.questionText}</p>
                              <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--classroom-text-muted)]">{questionTypeLabel(question.questionType)} · {question.points} {question.points === 1 ? "pt" : "pts"}</span>
                            </div>
                            {question.options.length ? (
                              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                {question.options.map((option) => (
                                  <li key={option.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", option.isCorrect ? "border-[var(--app-success-border)] bg-[var(--app-success-soft)] text-[var(--app-success)]" : "border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] text-[var(--classroom-text-muted)]")}>
                                    {option.isCorrect ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />}
                                    {option.optionText}
                                  </li>
                                ))}
                              </ul>
                            ) : acceptedAnswers.length ? (
                              <p className="mt-3 text-xs text-[var(--classroom-text-muted)]"><span className="font-semibold text-[var(--classroom-text)]">Accepted answer:</span> {acceptedAnswers.join(" / ")}</p>
                            ) : (
                              <p className="mt-3 text-xs italic text-[var(--classroom-text-muted)]">Manually graded response</p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          ) : null}
        </WorkspaceDialogBody>

        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={onClose}>Close</WorkspaceButton>
          {testId ? <Link href={`/classroom/${classroomId}/tests/${testId}`} className={workspaceButtonVariants({ variant: "primary" })}>Open grading dashboard</Link> : null}
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
