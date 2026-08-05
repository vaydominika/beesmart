import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseBuilderClient from "./CourseBuilderClient";
import type { CourseBuilderCourse } from "@/lib/course-builder";

vi.mock("./CourseBuilderSidebar", () => ({ default: () => <div data-testid="syllabus">Syllabus panel</div> }));
vi.mock("./CourseBuilderEditor", () => ({
  default: ({ previewMode }: { previewMode: boolean }) => <div data-testid="lesson-editor">{previewMode ? "Preview lesson" : "Edit lesson"}</div>,
}));
vi.mock("./CourseInviteButton", () => ({ CourseInviteButton: () => <button type="button">Invite</button> }));

afterEach(() => vi.unstubAllGlobals());

const course: CourseBuilderCourse = {
  id: "course-1",
  title: "Biology",
  description: null,
  coverImageUrl: null,
  createdById: "teacher-1",
  classroomId: null,
  isPublic: true,
  visibility: "PUBLIC",
  published: false,
  modules: [{
    id: "module-1",
    courseId: "course-1",
    title: "Cells",
    description: null,
    order: 0,
    lessons: [{ id: "lesson-1", moduleId: "module-1", title: "Cell structure", description: null, content: "", contentDraft: null, order: 0, isLocked: false }],
  }],
};

describe("CourseBuilderClient", () => {
  it("presents the editing workspace and accessible publish controls", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    expect(screen.getAllByTestId("syllabus").length).toBeGreaterThan(0);
    expect(screen.getByTestId("lesson-editor")).toHaveTextContent("Edit lesson");
    expect(screen.getByRole("switch", { name: "Publish lesson edits automatically" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("switches to a focused learner preview", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTestId("lesson-editor")).toHaveTextContent("Preview lesson");
    expect(screen.getByRole("button", { name: "Exit preview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Course visibility:/ })).not.toBeInTheDocument();
  });

  it("uses an accessible visibility menu and closes it outside", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ visibility: "PRIVATE" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderClient initialCourse={course} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Course visibility: Public" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menu", { name: "Course visibility options" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Private" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1", expect.objectContaining({ method: "PATCH" })));
    expect(screen.getByRole("button", { name: "Course visibility: Private" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Course visibility: Private" }), { button: 0, ctrlKey: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Course visibility options" })).not.toBeInTheDocument());
  });

  it("allows manual lesson publishing mode", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    const toggle = screen.getByRole("switch", { name: "Publish lesson edits automatically" });
    const thumb = toggle.querySelector("[data-switch-thumb]");
    expect(thumb).toHaveClass("translate-x-4");
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(thumb).toHaveClass("translate-x-0");
    const publishLesson = screen.getByRole("button", { name: "Publish lesson" });
    expect(publishLesson).toBeDisabled();
    expect(publishLesson).toHaveClass("h-8", "rounded-lg", "px-3", "text-xs");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveClass("h-8", "rounded-lg", "px-3", "text-xs");
    expect(screen.getByRole("button", { name: "Publish" })).toHaveClass("h-8", "rounded-lg", "px-3", "text-xs");
  });
});
