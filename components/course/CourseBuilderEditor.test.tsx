import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseBuilderEditor from "./CourseBuilderEditor";
import type { CourseBuilderEditorHandle } from "./CourseBuilderEditor";
import type { CourseBuilderLesson } from "@/lib/course-builder";

vi.mock("@/components/ui/editor", () => ({
  Editor: ({ editable = true, initialValue = "", onChange, id }: { editable?: boolean; initialValue?: string; onChange?: (value: string, id: string) => void; id?: string }) => (
    <div data-testid="rich-editor" data-value={initialValue}>
      {editable ? (
        <>
          <button type="button" onClick={() => onChange?.("<p>New lesson content</p>", id ?? "")}>Change editor content</button>
          <button type="button" onClick={() => onChange?.("<p>Cells</p>", id ?? "")}>Revert editor content</button>
        </>
      ) : "Read only"}
    </div>
  ),
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
  it("uses a white surface for the learner preview header", () => {
    render(<CourseBuilderEditor lesson={lesson} courseId="course-1" previewMode onLessonUpdate={vi.fn()} />);

    expect(screen.getByText("Learner preview").closest("header")).toHaveClass("bg-[var(--app-surface)]");
    expect(screen.getByText("Learner preview").closest("header")).not.toHaveClass("bg-[var(--course-accent)]");
  });

  it("flushes pending lesson changes when the course is saved", async () => {
    const onDirtyChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...lesson, title: "Cell anatomy", contentDraft: lesson.content }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const ref = createRef<CourseBuilderEditorHandle>();
    render(<CourseBuilderEditor ref={ref} lesson={lesson} courseId="course-1" onDirtyChange={onDirtyChange} onLessonUpdate={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Lesson title" }), { target: { value: "Cell anatomy" } });
    expect(onDirtyChange).toHaveBeenCalledWith(true);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      expect(await ref.current?.save()).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/modules/module-1/lessons/lesson-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Cell anatomy" }) }),
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("clears lesson dirty state only after every edit is reverted", () => {
    const onDirtyChange = vi.fn();
    render(<CourseBuilderEditor lesson={lesson} courseId="course-1" onDirtyChange={onDirtyChange} onLessonUpdate={vi.fn()} />);

    const titleInput = screen.getByRole("textbox", { name: "Lesson title" });
    fireEvent.change(titleInput, { target: { value: "Cell anatomy" } });
    fireEvent.click(screen.getByRole("button", { name: "Change editor content" }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.change(titleInput, { target: { value: "Cell structure" } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Revert editor content" }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the current lesson content visible while a save is in progress", async () => {
    let resolveSave!: (response: { ok: boolean; json: () => Promise<CourseBuilderLesson> }) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const ref = createRef<CourseBuilderEditorHandle>();
    const stableDirtyHandler = vi.fn();
    const { rerender } = render(<CourseBuilderEditor ref={ref} lesson={lesson} courseId="course-1" onDirtyChange={stableDirtyHandler} onLessonUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Change editor content" }));
    expect(screen.getByTestId("rich-editor")).toHaveAttribute("data-value", "<p>New lesson content</p>");

    let savePromise!: Promise<boolean>;
    act(() => { savePromise = ref.current!.save(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    rerender(<CourseBuilderEditor ref={ref} lesson={lesson} courseId="course-1" onDirtyChange={stableDirtyHandler} onLessonUpdate={vi.fn()} />);
    expect(screen.getByTestId("rich-editor")).toHaveAttribute("data-value", "<p>New lesson content</p>");

    await act(async () => {
      resolveSave({ ok: true, json: async () => ({ ...lesson, contentDraft: "<p>New lesson content</p>" }) });
      expect(await savePromise).toBe(true);
    });
  });

  it("opens and closes the restrained AI assistant", () => {
    render(<CourseBuilderEditor lesson={lesson} courseId="course-1" onLessonUpdate={vi.fn()} />);
    expect(screen.getByText("Editable", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByLabelText("Lesson title")).toHaveValue("Cell structure");
    expect(screen.getByLabelText("Lesson title")).toHaveClass(
      "rounded-lg",
      "transition-colors",
      "hover:bg-[var(--course-surface-muted)]",
      "hover:text-[var(--course-text-muted)]",
      "motion-reduce:transition-none",
    );
    expect(screen.getByRole("region", { name: "Lesson content editor" })).toHaveClass(
      "focus-within:border-[var(--course-focus-border)]",
      "focus-within:ring-2",
      "focus-within:ring-[var(--course-focus-ring)]",
    );
    expect(screen.queryByRole("button", { name: "Glossary block" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Knowledge check" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Improve selection" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Improve lesson" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create lesson" }));
    expect(screen.getByRole("region", { name: "AI lesson assistant" })).toBeInTheDocument();
    const sourceFileButton = screen.getByRole("button", { name: "Choose a source file" });
    expect(sourceFileButton).toHaveAttribute("data-variant", "secondary");
    expect(sourceFileButton).toHaveClass("border-dashed");
    const createContentButton = screen.getByRole("button", { name: "Create content" });
    expect(createContentButton).toBeDisabled();
    expect(createContentButton).toHaveAttribute("data-variant", "secondary");
    fireEvent.change(screen.getByRole("textbox", { name: "Lesson generation prompt" }), { target: { value: "Explain cell anatomy" } });
    expect(createContentButton).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Close AI assistant" }));
    expect(screen.queryByRole("region", { name: "AI lesson assistant" })).not.toBeInTheDocument();
  });

  it("keeps the lesson prompt open when a save response refreshes the same lesson", () => {
    const { rerender } = render(<CourseBuilderEditor lesson={lesson} courseId="course-1" onLessonUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create lesson" }));
    const prompt = screen.getByRole("textbox", { name: "Lesson generation prompt" });
    fireEvent.change(prompt, { target: { value: "Build a visual introduction to cell anatomy" } });

    rerender(<CourseBuilderEditor lesson={{ ...lesson, title: "Cell anatomy", contentDraft: "<p>Saved cells</p>" }} courseId="course-1" onLessonUpdate={vi.fn()} />);

    expect(screen.getByRole("region", { name: "AI lesson assistant" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Lesson generation prompt" })).toHaveValue("Build a visual introduction to cell anatomy");
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
