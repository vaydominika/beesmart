"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lightbulb,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { cn } from "@/lib/utils";

type TutorialIntent = "create" | "review";

interface CourseCreationTutorialProps {
  open: boolean;
  intent: TutorialIntent;
  onClose: () => void;
  onFinish: () => Promise<boolean> | boolean;
}

const STEPS: Array<{
  eyebrow: string;
  title: string;
  description: string;
  actions: string[];
}> = [
  {
    eyebrow: "Create the draft",
    title: "Start from New course",
    description: "On the Courses page, select New course. Complete the two setup screens, then BeeSmart opens the new draft in the course builder.",
    actions: [
      "Enter a course title, choose its visibility, and optionally add a cover image.",
      "Select Continue, then add an optional description or source materials.",
      "Select Create course to open the new draft in the course builder.",
    ],
  },
  {
    eyebrow: "Build and edit",
    title: "Add modules, lessons, and content",
    description: "Build the syllabus, open a lesson, and add its content. Each AI creation tool has 3 attempts per day.",
    actions: [
      "Add modules and lessons in the Syllabus.",
      "Open a lesson to write it yourself or create content with AI.",
      "Select Save when the syllabus and lesson content are ready.",
    ],
  },
  {
    eyebrow: "Preview and publish",
    title: "Save, then publish",
    description: "After saving, you can publish the course. A short audit checks it before it officially goes live.",
    actions: [
      "Select Save to store the latest changes.",
      "Preview the course if you want to check the learner view.",
      "Select Publish. The audit runs automatically before the course goes live.",
    ],
  },
];

export function CourseCreationTutorial({ open, intent, onClose, onFinish }: CourseCreationTutorialProps) {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = STEPS[step];

  const resetAndClose = () => {
    if (finishing) return;
    setStep(0);
    setError(null);
    onClose();
  };

  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      const completed = await onFinish();
      if (completed) setStep(0);
      else setError("The tutorial could not be saved. Check your connection and try again.");
    } catch {
      setError("The tutorial could not be saved. Check your connection and try again.");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) resetAndClose(); }}>
      <DialogContent className="course-dialog fixed bottom-0 left-0 top-auto flex max-h-[96dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-3xl border border-[var(--course-line-strong)] bg-[var(--app-surface)] p-0 shadow-2xl md:left-[50%] md:top-[50%] md:h-[min(96dvh,820px)] md:w-[calc(100vw-64px)] md:max-w-[1120px] md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl">
        <div className="grid min-h-0 flex-1 md:grid-cols-[292px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[var(--course-accent-hover)] bg-[var(--course-accent)] p-8 md:flex md:flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--course-accent-hover)] bg-[var(--app-surface)]">
              <Lightbulb className="h-5 w-5" />
            </span>
            <p className="mt-6 text-sm font-medium text-[var(--course-text-muted)]">Course builder guide</p>
            <h2 className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.035em] text-[var(--course-text)]">Create, edit, and publish</h2>

            <ol className="mt-10 space-y-2" aria-label="Tutorial progress">
              {STEPS.map((item, index) => (
                <li key={item.eyebrow} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", index === step ? "border-[var(--course-accent-hover)] bg-[var(--app-surface)] font-semibold text-[var(--course-text)] shadow-sm" : "border-transparent text-[var(--course-text-muted)]")}>
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold", index < step ? "border-[var(--course-success)] bg-[var(--course-success-soft)] text-[var(--course-success)]" : "border-[var(--course-line-strong)] bg-[var(--course-surface-muted)]")}>
                    {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  {item.eyebrow}
                </li>
              ))}
            </ol>

            <p className="mt-auto border-t border-[var(--course-accent-hover)] pt-6 text-xs leading-5 text-[var(--course-text-muted)]">You can reopen this guide anytime from the lightbulb on the Courses page.</p>
          </aside>

          <section className="flex min-h-0 flex-col">
            <header className="flex items-start gap-5 border-b border-[var(--course-line)] px-5 py-4 md:px-9 md:py-5">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-[var(--course-text)]">Course creation tutorial</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-[var(--course-text-muted)]">Follow the controls you will use from the first draft to publication.</DialogDescription>
              </div>
              <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={resetAndClose} disabled={finishing} aria-label="Close tutorial"><X className="h-4 w-4" /></WorkspaceButton>
            </header>

            <div className="course-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-9">
              <div className="mx-auto w-full max-w-[760px]">
                <div className="mb-5 flex gap-1 md:hidden" aria-hidden="true">
                  {STEPS.map((item, index) => <span key={item.eyebrow} className={cn("h-1.5 flex-1 rounded-full", index <= step ? "bg-[var(--course-focus-border)]" : "bg-[var(--course-surface-muted)]")} />)}
                </div>

                <div className="flex items-center gap-2 text-sm text-[var(--course-text-muted)]">
                  <span className="rounded-md border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--course-text)]">Step {step + 1} of {STEPS.length}</span>
                  <span>{current.eyebrow}</span>
                </div>
                <h3 className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.15] tracking-[-0.035em] text-[var(--course-text)] md:text-[34px]">{current.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--course-text-muted)]">{current.description}</p>

                {step === 0 && <CourseSetupScreenshots />}
                {step === 1 && <CourseBuilderScreenshots />}
                {step === 2 && <PublishingPath />}

                <p className="mt-4 text-xs font-semibold text-[var(--course-text-muted)]">What you will do</p>
                <ol className="mt-1.5 divide-y divide-[var(--course-line)] overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)]">
                  {current.actions.map((action, index) => (
                    <li key={action} className="flex items-start gap-3 px-4 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--course-line-strong)] bg-[var(--app-surface)] font-mono text-[10px] font-semibold text-[var(--course-text)]">{index + 1}</span>
                      <p className="pt-0.5 text-xs leading-5 text-[var(--course-text-muted)]">{action}</p>
                    </li>
                  ))}
                </ol>

                {error && <p role="alert" className="mt-4 rounded-xl bg-[var(--course-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--course-danger)]">{error}</p>}
              </div>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-[var(--course-line)] bg-[var(--app-surface)] px-5 py-4 md:px-9">
              <WorkspaceButton type="button" variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || finishing}><ArrowLeft className="h-4 w-4" />Back</WorkspaceButton>
              {step < STEPS.length - 1 ? (
                <WorkspaceButton type="button" variant="primary" onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>Next<ArrowRight className="h-4 w-4" /></WorkspaceButton>
              ) : (
                <WorkspaceButton type="button" variant="primary" onClick={() => void finish()} disabled={finishing}>
                  {finishing ? "Saving…" : intent === "create" ? "Continue to course setup" : "Finish review"}<Check className="h-4 w-4" />
                </WorkspaceButton>
              )}
            </footer>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CourseSetupScreenshots() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="The two course setup screens">
      <figure className="relative overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] shadow-sm">
        <Image
          src="/images/tutorial/course-setup-basics.png"
          alt="Course setup basics screen with title, visibility, and cover image fields"
          width={877}
          height={363}
          loading="eager"
          sizes="(min-width: 640px) 360px, calc(100vw - 40px)"
          className="h-auto w-full"
        />
        <figcaption className="absolute right-2 top-2 rounded-md border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--course-text)] shadow-sm">1 · Basics</figcaption>
      </figure>
      <figure className="relative overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] shadow-sm">
        <Image
          src="/images/tutorial/course-setup-details.png"
          alt="Course setup details screen with description and course materials fields"
          width={873}
          height={407}
          loading="eager"
          sizes="(min-width: 640px) 360px, calc(100vw - 40px)"
          className="h-auto w-full"
        />
        <figcaption className="absolute right-2 top-2 rounded-md border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--course-text)] shadow-sm">2 · Details</figcaption>
      </figure>
    </div>
  );
}

function CourseBuilderScreenshots() {
  return (
    <div className="mt-4 grid gap-3" aria-label="Course syllabus and lesson editor screens">
      <figure className="relative flex h-[420px] items-center justify-center overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] p-3 shadow-sm md:h-[460px]">
        <Image
          src="/images/tutorial/course-builder-syllabus.png"
          alt="Syllabus builder with outline generation, modules, and lessons"
          width={287}
          height={728}
          loading="eager"
          sizes="220px"
          className="h-full w-auto max-w-full rounded-md border border-[var(--course-line)] bg-[var(--app-surface)]"
        />
        <figcaption className="absolute right-2 top-2 rounded-md border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--course-text)] shadow-sm">1 · Build the syllabus</figcaption>
      </figure>
      <figure className="relative overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] shadow-sm">
        <Image
          src="/images/tutorial/course-builder-lesson-content.png"
          alt="Lesson editor with options to create content from a prompt or source, or write the lesson manually"
          width={1569}
          height={773}
          loading="eager"
          sizes="(min-width: 768px) 760px, calc(100vw - 40px)"
          className="h-auto w-full"
        />
        <figcaption className="absolute right-2 top-2 rounded-md border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--course-text)] shadow-sm">2 · Create lesson content</figcaption>
      </figure>
    </div>
  );
}

function PublishingPath() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Publishing workflow">
      <figure className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] p-3 shadow-sm">
        <Image
          src="/images/tutorial/course-publish-saving.png"
          alt="Course builder saving changes before publishing"
          width={229}
          height={68}
          loading="eager"
          sizes="(min-width: 640px) 340px, calc(100vw - 40px)"
          className="h-auto w-full max-w-[360px] rounded-md border border-[var(--course-line)] bg-[var(--app-surface)]"
        />
        <figcaption className="absolute right-2 top-2 rounded-md border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--course-text)] shadow-sm">1 · Save changes</figcaption>
      </figure>
      <figure className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] p-3 shadow-sm">
        <Image
          src="/images/tutorial/course-publish-audit.png"
          alt="Publication safety check running before the course is published"
          width={483}
          height={357}
          loading="eager"
          sizes="(min-width: 640px) 340px, calc(100vw - 40px)"
          className="h-auto max-h-[260px] w-auto max-w-full rounded-md border border-[var(--course-line)] bg-[var(--app-surface)]"
        />
        <figcaption className="absolute right-2 top-2 rounded-md border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] px-2 py-1 text-[10px] font-semibold text-[var(--course-text)] shadow-sm">2 · Publication safety check</figcaption>
      </figure>
    </div>
  );
}
