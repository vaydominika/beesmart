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
  classroomId: null,
  isPublic: false,
  visibility: "PRIVATE",
  published: false,
  modules: [
    { id: "module-1", courseId: "course-1", title: "Cells", description: null, order: 0, lessons: [] },
    { id: "module-2", courseId: "course-1", title: "Genetics", description: null, order: 1, lessons: [] },
  ],
};

afterEach(() => {
  capturedDragEnd = undefined;
  vi.unstubAllGlobals();
});

describe("CourseBuilderSidebar module ordering", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Generate syllabus with AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Outline source text" }), {
      target: { value: "Photosynthesis converts light energy into chemical energy." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create syllabus" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe("/api/courses/course-1/generate-from-file");
    expect(request[1]).toEqual(expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    expect((request[1].body as FormData).get("text")).toBe("Photosynthesis converts light energy into chemical energy.");
    expect((request[1].body as FormData).get("file")).toBeNull();
  });
});
