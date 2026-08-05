import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseCard } from "./CourseCard";
import type { CourseSummary } from "@/lib/course-summary";

const learnerCourse: CourseSummary = {
  id: "course-1",
  title: "Biology",
  description: "<p>Cells <strong>without</strong> unsafe markup</p>",
  coverImageUrl: null,
  createdById: "teacher-1",
  classroomId: "classroom-1",
  isPublic: true,
  published: true,
  visibility: "PUBLIC",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
  relationship: "learner",
  isEnrolled: true,
  progress: 35,
  lastAccessedAt: null,
  lessonCount: 6,
  classrooms: [{ id: "classroom-1", name: "Matematika" }],
  creator: { id: "teacher-1", name: "Ada" },
  _count: { modules: 2, enrollments: 5 },
};

describe("CourseCard", () => {
  it("shows safe learner metadata and classroom origin", () => {
    render(<CourseCard course={learnerCourse} onClick={vi.fn()} />);
    expect(screen.getByText("Cells without unsafe markup")).toBeInTheDocument();
    expect(screen.getByText(/Classroom.*Matematika/)).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.queryByText(/<strong>/)).not.toBeInTheDocument();
  });

  it("opens through the provided routing intent", () => {
    const onClick = vi.fn();
    render(<CourseCard course={learnerCourse} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Biology, In progress/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses the Classroom card silhouette while preserving owner metadata", () => {
    const ownerCourse: CourseSummary = {
      ...learnerCourse,
      relationship: "owner",
      published: false,
      visibility: "PRIVATE",
      isEnrolled: false,
      progress: 0,
    };
    render(<CourseCard course={ownerCourse} onClick={vi.fn()} />);

    const card = screen.getByRole("button", { name: /Biology, created course/i });
    expect(card).toHaveClass("min-h-[210px]", "border-[var(--course-accent)]", "p-5");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByLabelText("2 modules")).toBeInTheDocument();
    expect(screen.getByLabelText("6 lessons")).toBeInTheDocument();
    expect(screen.getByLabelText("5 enrollments")).toBeInTheDocument();
  });
});
