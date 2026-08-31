"use client";

import { ArrowUpRight, BookOpen, Layers3, School, UserRound, UsersRound } from "lucide-react";
import { CourseSummary, learningStatus, plainTextExcerpt } from "@/lib/course-summary";
import { cn } from "@/lib/utils";
import { WorkspaceProgress } from "@/components/ui/workspace-progress";
import { EntityCardButton } from "@/components/ui/entity-card-button";

interface CourseCardProps {
  course: CourseSummary;
  onClick: () => void;
}

const VISIBILITY_LABELS: Record<CourseSummary["visibility"], string> = {
  PRIVATE: "Private",
  PUBLIC: "Public",
  INVITATION_ONLY: "Invitation only",
};

export function CourseCard({ course, onClick }: CourseCardProps) {
  const isOwner = course.relationship === "owner";
  const status = learningStatus(course);
  const statusLabel = status === "completed" ? "Completed" : status === "in-progress" ? "In progress" : "Not started";
  const description = plainTextExcerpt(course.description);
  const firstClassroom = course.classrooms[0];
  const cardStatus = isOwner ? (course.published ? "Published" : "Draft") : statusLabel;

  return (
    <EntityCardButton
      onClick={onClick}
      className="hover:border-[var(--course-line-strong)] hover:bg-[var(--course-surface-hover)] focus-visible:ring-[var(--course-focus-border)]"
      aria-label={`${course.title}, ${isOwner ? "created course" : statusLabel}`}
    >
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--course-text-muted)]">{cardStatus}</span>
        {isOwner && (
          <span className="rounded-full bg-[var(--course-surface-muted)] px-2.5 py-1 text-[10px] font-medium text-[var(--course-text-muted)]">
            {VISIBILITY_LABELS[course.visibility]}
          </span>
        )}
      </div>

      <h2 className="mb-2 line-clamp-2 text-xl font-semibold leading-tight tracking-[-0.025em] text-[var(--course-text)]">{course.title}</h2>
      {course.tags && course.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Course subjects">
          {course.tags.slice(0, 3).map((tag) => (
            <span key={tag.slug} className="rounded-full border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--course-text-muted)]">{tag.name}</span>
          ))}
        </div>
      )}
      {description ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-[var(--course-text-muted)]">{description}</p>
      ) : (
        <p className="text-sm text-[var(--course-text-faint)]">No description</p>
      )}

      <div className="mt-auto pt-4">
        {(firstClassroom || (!isOwner && course.creator.name)) && (
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--course-text-muted)]">
            {firstClassroom && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <School className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Classroom · {firstClassroom.name}</span>
                {course.classrooms.length > 1 && <span className="shrink-0">+{course.classrooms.length - 1}</span>}
              </span>
            )}
            {!isOwner && course.creator.name && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{course.creator.name}</span>
              </span>
            )}
          </div>
        )}

        {!isOwner && (
          <WorkspaceProgress value={course.isEnrolled ? course.progress : 0} label={course.isEnrolled ? "Progress" : "Available to join"} showValue={course.isEnrolled} className="mb-4" />
        )}

        <div className="flex items-center justify-between border-t border-[var(--course-line)] pt-4">
          <div className="flex items-center gap-3 text-sm font-medium text-[var(--course-text-muted)]">
            <span className="inline-flex items-center gap-1.5" aria-label={`${course._count.modules} modules`}><Layers3 className="h-4 w-4" />{course._count.modules}</span>
            <span className="inline-flex items-center gap-1.5" aria-label={`${course.lessonCount} lessons`}><BookOpen className="h-4 w-4" />{course.lessonCount}</span>
            {isOwner && <span className="inline-flex items-center gap-1.5" aria-label={`${course._count.enrollments} enrollments`}><UsersRound className="h-4 w-4" />{course._count.enrollments}</span>}
          </div>
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--course-accent-hover)] bg-[var(--course-accent)] text-[var(--course-text)] transition-colors", "group-hover:bg-[var(--course-accent-hover)]")}>
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </EntityCardButton>
  );
}
