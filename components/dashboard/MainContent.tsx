"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LearningCard } from "./LearningCard";
import { useDashboard } from "@/lib/DashboardContext";
import { ReportCourseModal } from "./ReportCourseModal";
import type { CourseCard } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CourseRail } from "./CourseRail";
import { CourseRatingModal } from "@/components/course/CourseRatingModal";

function courseTitleById(courses: CourseCard[], id: string): string {
  return courses.find((c) => c.id === id)?.title ?? "Course";
}

export function MainContent() {
  const router = useRouter();
  const { data, loading, refetch } = useDashboard();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCourseId, setReportCourseId] = useState<string | null>(null);
  const [ratingCourseId, setRatingCourseId] = useState<string | null>(null);

  const continueLearning = data?.continueLearning ?? [];
  const popularCourses = data?.popularCourses ?? [];
  const discoverCourses = data?.discoverCourses ?? [];
  const myCourses = data?.myCourses ?? [];

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



  return (
    <ScrollArea className="flex-1 bg-(--theme-bg)">
      <div className="p-6 space-y-8">
        {myCourses.length > 0 && (
          <CourseRail title="Your courses">
              {myCourses.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  progress={course.progress}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
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
                  onButtonClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
          </CourseRail>
        )}

        {(data?.finishedCourses && data.finishedCourses.length > 0) && (
          <CourseRail title="Finished">
              {data.finishedCourses.map((course) => (
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
                  buttonText="Review"
                  onButtonClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
          </CourseRail>
        )}

        {loading ? (
          <section id="discover">
            <h2 className="mb-4 text-2xl font-bold uppercase tracking-tight text-(--theme-text) md:text-[40px]">Discover</h2>
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8 text-(--theme-text)" />
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
                  onButtonClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
            </CourseRail>
        ) : (
          <section id="discover">
            <h2 className="mb-4 text-2xl font-bold uppercase tracking-tight text-(--theme-text) md:text-[40px]">Discover</h2>
            <p className="text-(--theme-text) text-lg">
              There are no courses yet. Create your first course or check back later for new content.
            </p>
          </section>
        )}

        <ReportCourseModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          courseId={reportCourseId}
          courseTitle={reportCourseTitle}
        />
        <CourseRatingModal open={Boolean(ratingCourseId)} onOpenChange={(open) => { if (!open) setRatingCourseId(null); }} courseId={ratingCourseId} courseTitle={ratingCourseId ? courseTitleById(allCourses, ratingCourseId) : ""} onSaved={refetch} />
      </div>
    </ScrollArea>
  );
}
