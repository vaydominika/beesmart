import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseBuilderClient from "./CourseBuilderClient";
import type { CourseBuilderCourse } from "@/lib/course-builder";

vi.mock("./CourseBuilderSidebar", () => ({
  default: ({ course, onCourseChange, isSaving }: { course: CourseBuilderCourse; onCourseChange: (course: Partial<CourseBuilderCourse>) => void; isSaving?: boolean }) => (
    <div data-testid="syllabus">
      Syllabus panel
      <button type="button" disabled={isSaving} onClick={() => onCourseChange({ modules: course.modules.map((module) => ({ ...module, title: `${module.title} changed` })) })}>Change syllabus</button>
      <button type="button" disabled={isSaving} onClick={() => onCourseChange({ modules: course.modules.map((module) => ({ ...module, title: module.title.replace(/ changed$/, "") })) })}>Revert syllabus</button>
    </div>
  ),
}));
vi.mock("./CourseBuilderEditor", () => ({
  default: ({ previewMode, onDirtyChange }: { previewMode: boolean; onDirtyChange: (dirty: boolean) => void }) => (
    <div data-testid="lesson-editor">
      {previewMode ? "Preview lesson" : "Edit lesson"}
      {!previewMode && (
        <>
          <button type="button" onClick={() => onDirtyChange(true)}>Change lesson</button>
          <button type="button" onClick={() => onDirtyChange(false)}>Revert lesson</button>
        </>
      )}
    </div>
  ),
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
    expect(screen.queryByRole("switch", { name: "Publish lesson edits automatically" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Audit course" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("limits the course title and sizes its editor from the text", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Biology" }));

    const titleInput = screen.getByRole("textbox", { name: "Course title" });
    expect(titleInput).toHaveAttribute("maxlength", "150");
    expect(titleInput).not.toHaveAttribute("size");
    expect(titleInput).toHaveClass("[field-sizing:content]", "min-w-[1ch]");

    fireEvent.change(titleInput, { target: { value: "Cell biology" } });
    expect(titleInput).toHaveValue("Cell biology");
  });

  it("shows only the first 45 title characters in the resting header", () => {
    const longTitle = "A".repeat(60);
    render(<CourseBuilderClient initialCourse={{ ...course, title: longTitle }} />);

    expect(screen.getByRole("button", { name: longTitle })).toHaveTextContent(`${"A".repeat(45)}...`);
  });

  it("keeps a renamed course title visible until the explicit save", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Cell biology", visibility: "PUBLIC" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderClient initialCourse={course} />);

    fireEvent.click(screen.getByRole("button", { name: "Biology" }));
    const titleInput = screen.getByRole("textbox", { name: "Course title" });
    fireEvent.change(titleInput, { target: { value: "Cell biology" } });
    fireEvent.blur(titleInput);

    expect(screen.getByRole("button", { name: "Cell biology" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ title: "Cell biology", visibility: "PUBLIC" }),
    })));
  });

  it("saves the course before publication", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Biology", visibility: "PUBLIC" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderClient initialCourse={course} />);

    fireEvent.click(screen.getByRole("button", { name: "Change syllabus" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("data-variant", "primary");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ title: "Biology", visibility: "PUBLIC" }),
    })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("data-variant", "secondary");
  });

  it("activates Save when a lesson changes", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Change lesson" }));
    expect(screen.getAllByRole("button", { name: "Change syllabus" })[0]).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("deactivates Save when lesson edits are reverted", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Change lesson" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Revert lesson" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("data-variant", "secondary");
  });

  it("deactivates Save when syllabus edits are reverted", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Change syllabus" })[0]);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Revert syllabus" })[0]);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("deactivates Save when a course-title edit is reverted", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Biology" }));
    const titleInput = screen.getByRole("textbox", { name: "Course title" });

    fireEvent.change(titleInput, { target: { value: "Cell biology" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    fireEvent.change(titleInput, { target: { value: "Biology" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("switches to a focused learner preview", () => {
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTestId("lesson-editor")).toHaveTextContent("Preview lesson");
    expect(screen.getByRole("button", { name: "Exit preview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Course visibility:/ })).not.toBeInTheDocument();
  });

  it("uses an accessible visibility menu and closes it outside", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body ?? "{}")) as { visibility?: string };
      return { ok: true, json: async () => ({ visibility: body.visibility }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderClient initialCourse={course} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Course visibility: Public" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menu", { name: "Course visibility options" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Private" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1", expect.objectContaining({ method: "PATCH" })));
    expect(screen.getByRole("button", { name: "Course visibility: Private" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Course visibility: Private" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Public" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Course visibility: Public" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Course visibility: Public" }), { button: 0, ctrlKey: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Course visibility options" })).not.toBeInTheDocument());
  });

  it("runs the automatic safety check and shows only publication blockers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        code: "COURSE_NOT_PUBLISHABLE",
        issues: [{ lessonId: "lesson-1", category: "CONTENT_SAFETY", reason: "The lesson contains unsafe instructions." }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderClient initialCourse={course} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(screen.getByText("The lesson contains unsafe instructions.")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Publication safety check" })).toBeInTheDocument();
    expect(screen.queryByText(/suggestion|score|strength/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ published: true }),
    }));
  });
});
