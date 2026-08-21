"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LearningCard } from "./LearningCard";
import { useDashboard } from "@/lib/DashboardContext";
import { ReportCourseModal } from "./ReportCourseModal";
import type { CourseCard } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { CourseRail } from "./CourseRail";
import { CourseRatingModal } from "@/components/course/CourseRatingModal";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { dashboardCourseMatchesSearch } from "@/lib/dashboard";

function courseTitleById(courses: CourseCard[], id: string): string {
  return courses.find((c) => c.id === id)?.title ?? "Course";
}

interface MainContentProps {
  searchQuery: string;
  onClearSearch: () => void;
}

export function MainContent({ searchQuery, onClearSearch }: MainContentProps) {
  const router = useRouter();
  const { data, loading, error, refetch } = useDashboard();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCourseId, setReportCourseId] = useState<string | null>(null);
  const [ratingCourseId, setRatingCourseId] = useState<string | null>(null);

  const queryActive = Boolean(searchQuery.trim());
  const filterCourses = (courses: CourseCard[]) =>
    queryActive ? courses.filter((course) => dashboardCourseMatchesSearch(course, searchQuery)) : courses;
  const continueLearning = filterCourses(data?.continueLearning ?? []);
  const popularCourses = filterCourses(data?.popularCourses ?? []);
  const discoverCourses = filterCourses(data?.discoverCourses ?? []);
  const myCourses = filterCourses(data?.myCourses ?? []);
  const finishedCourses = filterCourses(data?.finishedCourses ?? []);
  const hasSearchResults = [continueLearning, popularCourses, discoverCourses, myCourses, finishedCourses]
    .some((courses) => courses.length > 0);

  const allCourses = useMemo(
    () => [...(data?.continueLearning ?? []), ...(data?.popularCourses ?? []), ...(data?.discoverCourses ?? []), ...(data?.myCourses ?? []), ...(data?.finishedCourses ?? [])],
    [data]
  );
  const reportCourseTitle = reportCourseId
    ? courseTitleById(allCourses, reportCourseId)
    : "";

  const openReport = (courseId: string) => {
    setReportCourseId(courseId);
    setReportModalOpen(true);
  };



  if (error && !data) {
    return (
      <section className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] px-6 text-center">
        <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Dashboard courses could not be loaded</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--dashboard-text-muted)]">{error}</p>
        <WorkspaceButton type="button" variant="primary" onClick={() => void refetch()} className="mt-5">
          Try again
        </WorkspaceButton>
      </section>
    );
  }

  return (
      <div className="mt-7 space-y-7">
        {queryActive && !loading && !hasSearchResults && (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] px-6 text-center">
            <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">No courses match “{searchQuery.trim()}”</h2>
            <p className="mt-2 text-sm text-[var(--dashboard-text-muted)]">Try another title or description.</p>
            <WorkspaceButton type="button" variant="secondary" onClick={onClearSearch} className="mt-5">
              Clear search
            </WorkspaceButton>
          </section>
        )}

        {myCourses.length > 0 && (
          <CourseRail title="Your courses">
              {myCourses.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
                  actionLabel="Edit"
                  onButtonClick={() => router.push(`/courses/${course.id}/builder`)}
                />
              ))}
          </CourseRail>
        )}

        {continueLearning.length > 0 && (
          <CourseRail title="Continue learning">
              {continueLearning.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  progress={course.progress}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
                  onRateClick={(course.progress ?? 0) > 0 ? setRatingCourseId : undefined}
                  actionLabel="Continue"
                  onButtonClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
          </CourseRail>
        )}

        {popularCourses.length > 0 && (
          <CourseRail title="Popular now">
              {popularCourses.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  progress={course.progress}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
                  actionLabel="Open"
                  onButtonClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
          </CourseRail>
        )}

        {finishedCourses.length > 0 && (
          <CourseRail title="Finished">
              {finishedCourses.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  progress={course.progress}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
                  onRateClick={setRatingCourseId}
                  actionLabel="Review"
                  onButtonClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
          </CourseRail>
        )}

        {loading && !data ? (
          <section id="discover">
            <h2 className="mb-4 text-xl font-semibold tracking-[-0.025em] text-[var(--dashboard-text)] md:text-2xl">Discover</h2>
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)]">
              <Spinner className="h-7 w-7 text-[var(--dashboard-text-muted)]" />
            </div>
          </section>
        ) : discoverCourses.length > 0 ? (
            <CourseRail title="Discover" id="discover">
              {discoverCourses.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
                  actionLabel="Open"
                  onButtonClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
            </CourseRail>
        ) : !queryActive ? (
          <section id="discover">
            <h2 className="mb-4 text-xl font-semibold tracking-[-0.025em] text-[var(--dashboard-text)] md:text-2xl">Discover</h2>
            <p className="text-sm text-[var(--dashboard-text-muted)]">
              There are no courses yet. Create your first course or check back later for new content.
            </p>
          </section>
        ) : null}

        <ReportCourseModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          courseId={reportCourseId}
          courseTitle={reportCourseTitle}
          onSuccess={() => void refetch()}
        />
        <CourseRatingModal open={Boolean(ratingCourseId)} onOpenChange={(open) => { if (!open) setRatingCourseId(null); }} courseId={ratingCourseId} courseTitle={ratingCourseId ? courseTitleById(allCourses, ratingCourseId) : ""} onSaved={refetch} />
      </div>
  );
}
