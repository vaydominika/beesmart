import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseBuilderSidebar from "./CourseBuilderSidebar";
import type { CourseBuilderCourse } from "@/lib/course-builder";

type DragEndHandler = (result: {
  type: string;
  source: { droppableId: string; index: number };
  destination: { droppableId: string; index: number } | null;
}) => Promise<void>;

let capturedDragEnd: DragEndHandler | undefined;

function openActionMenu(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name }), { button: 0, ctrlKey: false });
}

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ onDragEnd, children }: { onDragEnd: DragEndHandler; children: React.ReactNode }) => {
    capturedDragEnd = onDragEnd;
    return children;
  },
  Droppable: ({ children }: { children: (provided: object, snapshot: object) => React.ReactNode }) => children(
    { innerRef: vi.fn(), droppableProps: {}, placeholder: null },
    { isDraggingOver: false },
  ),
  Draggable: ({ children }: { children: (provided: object, snapshot: object) => React.ReactNode }) => children(
    { innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} },
    { isDragging: false },
  ),
}));

const course: CourseBuilderCourse = {
  id: "course-1",
  title: "Biology",
  description: null,
  coverImageUrl: null,
  createdById: "teacher-1",
  isPublic: false,
  visibility: "PRIVATE",
  published: false,
  modules: [
    {
      id: "module-1",
      courseId: "course-1",
      title: "Cells",
      description: null,
      order: 0,
      lessons: [{ id: "lesson-1", moduleId: "module-1", title: "Cell structure", description: null, content: "", contentDraft: null, order: 0, isLocked: false }],
    },
    { id: "module-2", courseId: "course-1", title: "Genetics", description: null, order: 1, lessons: [] },
  ],
};

afterEach(() => {
  capturedDragEnd = undefined;
  vi.unstubAllGlobals();
});

describe("CourseBuilderSidebar module ordering", () => {
  it("places the leading control beside the syllabus heading", () => {
    render(
      <CourseBuilderSidebar
        course={course}
        onCourseChange={vi.fn()}
        activeLessonId={null}
        onSelectLesson={vi.fn()}
        leadingControl={<div data-testid="leading-control">Back</div>}
      />,
    );

    const leadingControl = screen.getByTestId("leading-control");
    const syllabusHeading = screen.getByRole("heading", { name: "Syllabus" });
    expect(leadingControl.parentElement).toBe(syllabusHeading.parentElement?.parentElement);
    expect(leadingControl.compareDocumentPosition(syllabusHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renames a module inline", async () => {
    const onCourseChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={onCourseChange} activeLessonId="lesson-1" onSelectLesson={vi.fn()} />);

    openActionMenu("Module actions for Cells");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit module Cells" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Module name for Cells" }), { target: { value: "Cell biology" } });
    fireEvent.click(screen.getByRole("button", { name: "Save module name" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/modules/module-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Cell biology" }) }),
    ));
    expect(onCourseChange).toHaveBeenCalledWith(expect.objectContaining({
      modules: expect.arrayContaining([expect.objectContaining({ id: "module-1", title: "Cell biology" })]),
    }));
  });

  it("renames a lesson inline", async () => {
    const onCourseChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={onCourseChange} activeLessonId="lesson-1" onSelectLesson={vi.fn()} />);

    openActionMenu("Lesson actions for Cell structure");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit lesson Cell structure" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Lesson name for Cell structure" }), { target: { value: "Inside the cell" } });
    fireEvent.click(screen.getByRole("button", { name: "Save lesson name" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/modules/module-1/lessons/lesson-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Inside the cell" }) }),
    ));
    expect(onCourseChange).toHaveBeenCalledWith(expect.objectContaining({
      modules: expect.arrayContaining([expect.objectContaining({
        id: "module-1",
        lessons: [expect.objectContaining({ id: "lesson-1", title: "Inside the cell" })],
      })]),
    }));
  });

  it("presents lesson rename cancellation as a non-destructive undo action", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    render(<CourseBuilderSidebar course={course} onCourseChange={vi.fn()} activeLessonId="lesson-1" onSelectLesson={vi.fn()} />);

    openActionMenu("Lesson actions for Cell structure");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit lesson Cell structure" }));

    const cancelButton = screen.getByRole("button", { name: "Cancel lesson rename" });
    expect(cancelButton).not.toHaveAttribute("title");
    fireEvent.focus(cancelButton);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Cancel editing. Changes won't be saved."));
    expect(document.querySelector('[data-slot="tooltip-content"]')).toHaveClass("bg-foreground", "text-background");

    fireEvent.click(cancelButton);

    expect(screen.queryByRole("textbox", { name: "Lesson name for Cell structure" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("warns before deleting a module and selects a safe fallback lesson", async () => {
    const onCourseChange = vi.fn();
    const onSelectLesson = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={onCourseChange} activeLessonId="lesson-1" onSelectLesson={onSelectLesson} />);

    openActionMenu("Module actions for Cells");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete module Cells" }));
    expect(screen.getByRole("heading", { name: "Delete module?" })).toBeInTheDocument();
    expect(screen.getByText(/permanently delete “Cells” and every lesson inside it/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete module" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1/modules/module-1", { method: "DELETE" }));
    expect(onCourseChange).toHaveBeenCalledWith({ modules: [expect.objectContaining({ id: "module-2" })] });
    expect(onSelectLesson).toHaveBeenCalledWith(null);
  });

  it("warns before deleting a lesson", async () => {
    const onCourseChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={onCourseChange} activeLessonId={null} onSelectLesson={vi.fn()} />);

    openActionMenu("Lesson actions for Cell structure");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete lesson Cell structure" }));
    expect(screen.getByRole("heading", { name: "Delete lesson?" })).toBeInTheDocument();
    expect(screen.getByText(/permanently delete “Cell structure”/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete lesson" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1/modules/module-1/lessons/lesson-1", { method: "DELETE" }));
    expect(onCourseChange).toHaveBeenCalledWith(expect.objectContaining({
      modules: expect.arrayContaining([expect.objectContaining({ id: "module-1", lessons: [] })]),
    }));
  });

  it("sets every lesson in a module as a prerequisite from the module menu", async () => {
    const onCourseChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={onCourseChange} activeLessonId={null} onSelectLesson={vi.fn()} />);

    openActionMenu("Module actions for Cells");
    fireEvent.click(screen.getByRole("menuitem", { name: "Set Cells as prerequisite" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/modules/module-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isPrerequisite: true }) }),
    ));
    expect(onCourseChange).toHaveBeenCalledWith(expect.objectContaining({
      modules: expect.arrayContaining([expect.objectContaining({
        id: "module-1",
        lessons: [expect.objectContaining({ id: "lesson-1", isLocked: true })],
      })]),
    }));
  });

  it("sets a lesson as a prerequisite from the lesson menu", async () => {
    const onCourseChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={onCourseChange} activeLessonId={null} onSelectLesson={vi.fn()} />);

    openActionMenu("Lesson actions for Cell structure");
    fireEvent.click(screen.getByRole("menuitem", { name: "Set Cell structure as prerequisite" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/modules/module-1/lessons/lesson-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isLocked: true }) }),
    ));
    expect(onCourseChange).toHaveBeenCalledWith(expect.objectContaining({
      modules: expect.arrayContaining([expect.objectContaining({
        id: "module-1",
        lessons: [expect.objectContaining({ id: "lesson-1", isLocked: true })],
      })]),
    }));
  });

  it("updates the module order optimistically and persists the normalized list", async () => {
    const onCourseChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={onCourseChange} activeLessonId={null} onSelectLesson={vi.fn()} />);

    await act(async () => {
      await capturedDragEnd?.({
        type: "MODULE",
        source: { droppableId: "course-modules", index: 0 },
        destination: { droppableId: "course-modules", index: 1 },
      });
    });

    expect(onCourseChange).toHaveBeenCalledWith({
      modules: [
        expect.objectContaining({ id: "module-2", order: 0 }),
        expect.objectContaining({ id: "module-1", order: 1 }),
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1/modules/reorder", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ list: [{ id: "module-2", order: 0 }, { id: "module-1", order: 1 }] }),
    }));
  });

  it("creates an outline from pasted source text without requiring a file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ outline: { modules: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseBuilderSidebar course={course} onCourseChange={vi.fn()} activeLessonId={null} onSelectLesson={vi.fn()} />);

    const aiButton = screen.getByRole("button", { name: "Generate syllabus with AI" });
    expect(aiButton).toHaveAttribute("data-size", "icon-compact");
    expect(aiButton).toHaveAttribute("data-variant", "secondary");
    expect(aiButton).toHaveClass("border");
    fireEvent.click(aiButton);
    expect(aiButton).toHaveAttribute("data-variant", "primary");
    expect(aiButton).toHaveClass("bg-[var(--app-accent-soft)]");
    expect(aiButton.className).not.toMatch(/shadow/);
    fireEvent.change(screen.getByRole("textbox", { name: "Outline source text" }), {
      target: { value: "Photosynthesis converts light energy into chemical energy." },
    });
    const createButton = screen.getByRole("button", { name: "Create syllabus" });
    expect(createButton).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByRole("textbox", { name: "Outline source text" }).compareDocumentPosition(createButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(createButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/generate-from-file",
      expect.objectContaining({ method: "POST" }),
    ));
    const request = fetchMock.mock.calls.find(([url]) => url === "/api/courses/course-1/generate-from-file")!;
    expect(request[0]).toBe("/api/courses/course-1/generate-from-file");
    expect(request[1]).toEqual(expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    expect((request[1].body as FormData).get("text")).toBe("Photosynthesis converts light energy into chemical energy.");
    expect((request[1].body as FormData).get("file")).toBeNull();
  });
});
