"use client";

import { useState, useMemo } from "react";
import { LearningCard } from "./LearningCard";
import { useDashboard } from "@/lib/DashboardContext";
import { ReportCourseModal } from "./ReportCourseModal";
import type { CourseCard } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";

function courseTitleById(courses: CourseCard[], id: string): string {
  return courses.find((c) => c.id === id)?.title ?? "Course";
}

export function MainContent() {
  const { data, loading } = useDashboard();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCourseId, setReportCourseId] = useState<string | null>(null);

  const continueLearning = data?.continueLearning ?? [];
  const popularCourses = data?.popularCourses ?? [];
  const discoverCourses = data?.discoverCourses ?? [];

  const allCourses = useMemo(
    () => [...continueLearning, ...popularCourses, ...discoverCourses],
    [continueLearning, popularCourses, discoverCourses]
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
        {continueLearning.length > 0 && (
          <section>
            <h2 className="text-2xl md:text-[40px] font-bold uppercase tracking-tight text-(--theme-text) mb-4">
              CONTINUE LEARNING
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              style={{ gridAutoRows: "1fr" }}
            >
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
                />
              ))}
            </div>
          </section>
        )}

        {popularCourses.length > 0 && (
          <section>
            <h2 className="text-2xl md:text-[40px] font-bold uppercase tracking-tight text-(--theme-text) mb-4">
              POPULAR NOW
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              style={{ gridAutoRows: "1fr" }}
            >
              {popularCourses.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
                />
              ))}
            </div>
          </section>
        )}

        <section id="discover">
          <h2 className="text-2xl md:text-[40px] font-bold uppercase tracking-tight text-(--theme-text) mb-4">
            DISCOVER
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8 text-(--theme-text)" />
            </div>
          ) : discoverCourses.length > 0 ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              style={{ gridAutoRows: "1fr" }}
            >
              {discoverCourses.map((course) => (
                <LearningCard
                  key={course.id}
                  id={course.id}
                  title={course.title}
                  description={course.description ?? ""}
                  coverImageUrl={course.coverImageUrl}
                  averageRating={course.averageRating}
                  onReportClick={openReport}
                />
              ))}
            </div>
          ) : (
            <p className="text-(--theme-text) text-lg">
              There are no courses yet. Create your first course or check back later for new content.
            </p>
          )}
        </section>

        <ReportCourseModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          courseId={reportCourseId}
          courseTitle={reportCourseTitle}
        />
      </div>
    </ScrollArea>
  );
}
