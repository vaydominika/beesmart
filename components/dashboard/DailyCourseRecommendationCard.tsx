"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, BookOpen, Sparkles, Star } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
} from "@/components/ui/workspace-dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Spinner } from "@/components/ui/spinner";
import { DashboardActionCard } from "./DashboardActionCard";
import type { CourseRecommendationKind, DailyCourseRecommendation } from "@/lib/ai/course-recommendations";

type RecommendationError = {
  code: string;
  message: string;
};

type DailyCourseRecommendationCardProps = {
  kind: CourseRecommendationKind;
  title: string;
  description: string;
  actionLabel: string;
};

const protectedCodes = new Set(["COURSE_COMPLETION_REQUIRED", "NO_ELIGIBLE_COURSES"]);

export function DailyCourseRecommendationCard({
  kind,
  title,
  description,
  actionLabel,
}: DailyCourseRecommendationCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<DailyCourseRecommendation | null>(null);
  const [error, setError] = useState<RecommendationError | null>(null);

  const modalTitle = kind === "HIVE_PICK" ? "Today's hive pick" : "Something new for today";
  const matchText = kind === "HIVE_PICK"
    ? "Chosen to build on courses you've already completed."
    : "Chosen to take you into a different subject.";

  const requestRecommendation = async () => {
    if (loading || recommendation) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboard/recommendations/${kind}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw {
          code: typeof body.code === "string" ? body.code : "RECOMMENDATION_UNAVAILABLE",
          message: typeof body.error === "string" ? body.error : "Today's course pick could not be prepared.",
        } satisfies RecommendationError;
      }
      setRecommendation(body as DailyCourseRecommendation);
    } catch (caught) {
      const nextError = caught && typeof caught === "object" && "message" in caught
        ? {
            code: "code" in caught && typeof caught.code === "string" ? caught.code : "RECOMMENDATION_UNAVAILABLE",
            message: typeof caught.message === "string" ? caught.message : "Today's course pick could not be prepared.",
          }
        : { code: "RECOMMENDATION_UNAVAILABLE", message: "Today's course pick could not be prepared." };
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    setError(null);
    void requestRecommendation();
  };

  const openCourse = () => {
    if (!recommendation) return;
    setOpen(false);
    router.push(`/courses/${recommendation.course.id}`);
  };

  const browseDashboardCourses = () => {
    setOpen(false);
    document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <DashboardActionCard
        title={title}
        description={description}
        actionLabel={actionLabel}
        actionPending={loading}
        onAction={() => void requestRecommendation()}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <WorkspaceDialogContent className="max-w-lg">
          <WorkspaceDialogHeader>
            <WorkspaceDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              {modalTitle}
            </WorkspaceDialogTitle>
            <WorkspaceDialogDescription>One course, selected for you each day.</WorkspaceDialogDescription>
          </WorkspaceDialogHeader>

          <WorkspaceDialogBody className="relative min-h-56" aria-live="polite">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.05]"
              style={{ backgroundImage: "url('/svg/CardBackground.svg')" }}
            />

            {loading ? (
              <div className="relative flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                <Spinner className="h-7 w-7" />
                <p className="text-sm font-medium text-[var(--app-text-muted)]">Checking your completed courses…</p>
              </div>
            ) : recommendation ? (
              <div className="relative flex min-h-48 flex-col justify-center rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_94%,transparent)] p-5 sm:p-6">
                <span className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--app-text-muted)]">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Daily pick
                </span>
                <h3 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--app-text)] sm:text-3xl">
                  {recommendation.course.title}
                </h3>
                {recommendation.course.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--app-text-muted)]">
                    {recommendation.course.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[var(--app-text-muted)]">
                  <span>{matchText}</span>
                  {recommendation.course.averageRating != null && recommendation.course.averageRating > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      {recommendation.course.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            ) : error ? (
              <div className="relative flex min-h-48 flex-col items-center justify-center text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--app-text)]">
                  {error.code === "COURSE_COMPLETION_REQUIRED" ? "Complete your first course" : error.code === "NO_ELIGIBLE_COURSES" ? "Nothing new is available" : "Pick unavailable"}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--app-text-muted)]">{error.message}</p>
              </div>
            ) : null}
          </WorkspaceDialogBody>

          <WorkspaceDialogFooter>
            <WorkspaceButton type="button" variant="secondary" onClick={() => setOpen(false)}>
              Close
            </WorkspaceButton>
            {recommendation ? (
              <WorkspaceButton type="button" variant="primary" onClick={openCourse}>
                Open course
              </WorkspaceButton>
            ) : error && protectedCodes.has(error.code) ? (
              <WorkspaceButton type="button" variant="primary" onClick={browseDashboardCourses}>
                Browse courses
              </WorkspaceButton>
            ) : error ? (
              <WorkspaceButton type="button" variant="primary" onClick={retry}>
                Try again
              </WorkspaceButton>
            ) : null}
          </WorkspaceDialogFooter>
        </WorkspaceDialogContent>
      </Dialog>
    </>
  );
}
