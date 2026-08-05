import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseBuilderEditor from "./CourseBuilderEditor";
import type { CourseBuilderLesson } from "@/lib/course-builder";

vi.mock("@/components/ui/editor", () => ({
  Editor: ({ editable = true }: { editable?: boolean }) => <div data-testid="rich-editor">{editable ? "Editable" : "Read only"}</div>,
}));

const lesson: CourseBuilderLesson = {
  id: "lesson-1",
  moduleId: "module-1",
  title: "Cell structure",
  description: null,
  content: "<p>Cells</p>",
  contentDraft: null,
  order: 0,
  isLocked: false,
  files: [{
    id: "file-1",
    fileName: "cell-diagram.png",
    fileUrl: "/uploads/cell-diagram.png",
    fileSize: 1200,
    isVisible: true,
  }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CourseBuilderEditor", () => {
  it("opens and closes the restrained AI assistant", () => {
    render(<CourseBuilderEditor lesson={lesson} courseId="course-1" onLessonUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "AI assist" }));
    expect(screen.getByRole("region", { name: "AI lesson assistant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create content" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close AI assistant" }));
    expect(screen.queryByRole("region", { name: "AI lesson assistant" })).not.toBeInTheDocument();
  });

  it("renders a read-only learner preview", () => {
    render(<CourseBuilderEditor lesson={lesson} courseId="course-1" previewMode onLessonUpdate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Cell structure" })).toBeInTheDocument();
    expect(screen.getByTestId("rich-editor")).toHaveTextContent("Read only");
  });

  it("lets the owner hide an attached file from learners", async () => {
    const onLessonUpdate = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...lesson.files?.[0], isVisible: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CourseBuilderEditor lesson={lesson} courseId="course-1" onLessonUpdate={onLessonUpdate} />);
    fireEvent.click(screen.getByRole("switch", { name: "Hide cell-diagram.png from learners" }));

    expect(onLessonUpdate).toHaveBeenCalledWith(expect.objectContaining({
      files: [expect.objectContaining({ id: "file-1", isVisible: false })],
    }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/files/file-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isVisible: false }),
      }),
    ));
  });
});
