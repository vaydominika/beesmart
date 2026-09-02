"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, Lightbulb, Plus } from "lucide-react";
import { AddCourseToClassroomModal } from "@/components/course/AddCourseToClassroomModal";
import { CourseCard } from "@/components/course/CourseCard";
import { CourseCreationTutorial } from "@/components/course/CourseCreationTutorial";
import { CourseStatusFilter } from "@/components/course/CourseStatusFilter";
import { CreateCourseModal } from "@/components/course/CreateCourseModal";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { WorkspaceSearchField } from "@/components/ui/workspace-search-field";
import { WorkspaceEmptyState } from "@/components/ui/workspace-state";
import { LibraryToolbar, WorkspacePageFrame, WorkspacePageHeader } from "@/components/ui/workspace-page";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CourseSummary,
  CourseTab,
  CreatedStatus,
  LearningStatus,
  courseMatchesSearch,
  initialCourseTab,
  learningStatus,
  sortCreatedCourses,
  sortLearningCourses,
} from "@/lib/course-summary";

const TAB_KEY = "courses-active-tab";

function CourseSkeleton() {
  return (
    <div className="min-h-[210px] animate-pulse rounded-2xl border border-[var(--course-line)] bg-[var(--app-surface)] p-5">
      <div className="h-3 w-16 rounded bg-[var(--course-surface-muted)]" />
      <div className="mt-4 h-5 w-2/3 rounded bg-[var(--course-surface-muted)]" />
      <div className="mt-3 h-3 w-full rounded bg-[var(--course-surface-muted)]" />
      <div className="mt-2 h-3 w-4/5 rounded bg-[var(--course-surface-muted)]" />
      <div className="mt-8 flex items-center justify-between border-t border-[var(--course-line)] pt-4">
        <div className="h-4 w-28 rounded bg-[var(--course-surface-muted)]" />
        <div className="h-9 w-9 rounded-full bg-[var(--course-accent)]" />
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [activeTab, setActiveTab] = useState<CourseTab | null>(null);
  const [search, setSearch] = useState("");
  const [learningFilter, setLearningFilter] = useState<LearningStatus>("all");
  const [createdFilter, setCreatedFilter] = useState<CreatedStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addToClassroomOpen, setAddToClassroomOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialIntent, setTutorialIntent] = useState<"create" | "review">("review");
  const [tutorialCompleted, setTutorialCompleted] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load your courses.");
      const data = await response.json() as CourseSummary[];
      setCourses(data);
      setActiveTab((current) => current ?? initialCourseTab(window.localStorage.getItem(TAB_KEY), data));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load your courses.");
      setActiveTab((current) => current ?? "created");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    const fetchTutorialStatus = async () => {
      try {
        const response = await fetch("/api/user/settings", { cache: "no-store" });
        if (!response.ok) return;
        const settings = await response.json() as { courseCreationTutorialCompleted?: boolean };
        setTutorialCompleted(settings.courseCreationTutorialCompleted === true);
      } catch {
        // Keep creation locked until completion can be confirmed by the server.
      }
    };
    void fetchTutorialStatus();
  }, []);

  const openCourseCreation = () => {
    if (tutorialCompleted) {
      setCreateOpen(true);
      return;
    }
    setTutorialIntent("create");
    setTutorialOpen(true);
  };

  const reviewTutorial = () => {
    setTutorialIntent("review");
    setTutorialOpen(true);
  };

  const finishTutorial = async () => {
    if (tutorialIntent === "review") {
      setTutorialOpen(false);
      return true;
    }
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseCreationTutorialCompleted: true }),
      });
      if (!response.ok) return false;
      setTutorialCompleted(true);
      setTutorialOpen(false);
      setCreateOpen(true);
      return true;
    } catch {
      toast.error("The tutorial could not be saved.");
      return false;
    }
  };

  const changeTab = (tab: CourseTab) => {
    setActiveTab(tab);
    window.localStorage.setItem(TAB_KEY, tab);
  };

  const visibleCourses = useMemo(() => {
    if (!activeTab) return [];
    const relationship = activeTab === "learning" ? "learner" : "owner";
    const matching = courses.filter((course) => course.relationship === relationship && courseMatchesSearch(course, search));
    if (activeTab === "learning") {
      const filtered = learningFilter === "all" ? matching : matching.filter((course) => learningStatus(course) === learningFilter);
      return sortLearningCourses(filtered);
    }
    const filtered = createdFilter === "all" ? matching : matching.filter((course) => createdFilter === "published" ? course.published : !course.published);
    return sortCreatedCourses(filtered);
  }, [activeTab, courses, createdFilter, learningFilter, search]);

  const hasActiveFilters = Boolean(search.trim()) || (activeTab === "learning" ? learningFilter !== "all" : createdFilter !== "all");

  return (
    <WorkspacePageFrame className="course-ui bg-[var(--course-canvas)]">
        <WorkspacePageHeader title="Courses" titleClassName="text-[var(--course-text)]" actions={<div className="flex items-center gap-2">
            <Tooltip><TooltipTrigger asChild><WorkspaceButton type="button" variant="secondary" size="icon" onClick={reviewTutorial} aria-label="Review course creation tutorial">
              <Lightbulb className="h-4 w-4" />
            </WorkspaceButton></TooltipTrigger><TooltipContent>Course creation tutorial</TooltipContent></Tooltip>
            <WorkspaceButton type="button" variant="primary" onClick={openCourseCreation}>
              <Plus className="h-4 w-4" />New course
            </WorkspaceButton>
          </div>} />

        <LibraryToolbar className="border-[var(--course-line)]">
          <WorkspaceTabs
            ariaLabel="Course library"
            value={activeTab ?? "created"}
            onValueChange={changeTab}
            items={[{ value: "learning", label: "Learning" }, { value: "created", label: "Created" }] satisfies Array<{ value: CourseTab; label: string }>}
            fill
            className="sm:w-auto"
          />

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <WorkspaceSearchField type="search" name="course-query" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search courses" aria-label="Search courses" wrapperClassName="flex-1 sm:w-64 sm:flex-none" className="border-[var(--course-line)] bg-[var(--course-surface-muted)] text-[var(--course-text)] placeholder:text-[var(--course-text-faint)] focus:border-[var(--course-focus-border)] focus:ring-[var(--course-focus-ring)]" />
            <CourseStatusFilter activeTab={activeTab ?? "created"} learningFilter={learningFilter} createdFilter={createdFilter} onLearningChange={setLearningFilter} onCreatedChange={setCreatedFilter} />
            {activeTab === "created" && (
              <WorkspaceButton type="button" variant="secondary" onClick={() => setAddToClassroomOpen(true)}>
                <BookPlus className="h-4 w-4" />Add to classroom
              </WorkspaceButton>
            )}
          </div>
        </LibraryToolbar>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,350px))]" aria-label="Loading courses">
            {Array.from({ length: 4 }, (_, index) => <CourseSkeleton key={index} />)}
          </div>
        ) : error ? (
          <WorkspaceEmptyState title="Your courses could not be loaded" description={error} className="min-h-72 border-[var(--course-line)]" action={<WorkspaceButton type="button" variant="primary" onClick={() => void fetchCourses()}>Try again</WorkspaceButton>} />
        ) : visibleCourses.length ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,350px))]" aria-label={activeTab === "learning" ? "Courses you are learning" : "Courses you created"}>
            {visibleCourses.map((course) => <CourseCard key={course.id} course={course} onClick={() => router.push(course.relationship === "owner" ? `/courses/${course.id}/builder` : `/courses/${course.id}`)} />)}
          </section>
        ) : (
          <WorkspaceEmptyState title={hasActiveFilters ? "No courses match these filters" : activeTab === "learning" ? "No courses to learn yet" : "Create your first course"} description={hasActiveFilters ? "Try a different search or status." : activeTab === "learning" ? "Courses you join or receive through a Classroom will appear here." : "Build lessons, add materials, and share the course when it is ready."} className="min-h-72 border-[var(--course-line)]" action={hasActiveFilters ? <WorkspaceButton type="button" variant="secondary" onClick={() => { setSearch(""); setLearningFilter("all"); setCreatedFilter("all"); }}>Clear filters</WorkspaceButton> : activeTab === "created" ? <WorkspaceButton type="button" variant="primary" onClick={openCourseCreation}>New course</WorkspaceButton> : null} />
        )}
      <CourseCreationTutorial open={tutorialOpen} intent={tutorialIntent} onClose={() => setTutorialOpen(false)} onFinish={finishTutorial} />
      <CreateCourseModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(course) => router.push(`/courses/${course.id}/builder`)} />
      <AddCourseToClassroomModal open={addToClassroomOpen} onClose={() => setAddToClassroomOpen(false)} onAdded={() => void fetchCourses()} />
    </WorkspacePageFrame>
  );
}
