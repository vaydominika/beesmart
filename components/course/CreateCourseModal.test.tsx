import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateCourseModal } from "./CreateCourseModal";

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/components/ui/editor", () => ({
  Editor: ({ placeholder, onChange }: { placeholder: string; onChange: (value: string) => void }) => <textarea aria-label="Course description" placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />,
}));
vi.mock("sonner", () => ({ toast: mocks }));

afterEach(() => vi.unstubAllGlobals());

describe("CreateCourseModal", () => {
  it("validates the title before opening details", () => {
    render(<CreateCourseModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByPlaceholderText("Introduction to biology")).toHaveAttribute("maxlength", "150");
    expect(screen.getByText("Visibility", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("(you can change this later)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a course title");
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
  });

  it("retains basics when moving forward and backward", () => {
    render(<CreateCourseModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Introduction to biology"), { target: { value: "Cell biology" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByDisplayValue("Cell biology")).toBeInTheDocument();
  });

  it("clears an abandoned draft when cancelled", () => {
    const onClose = vi.fn();
    render(<CreateCourseModal open onClose={onClose} onCreated={vi.fn()} />);
    const title = screen.getByPlaceholderText("Introduction to biology");
    fireEvent.change(title, { target: { value: "Discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(title).toHaveValue("");
  });

  it("uploads and removes a cover image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ uploadId: "cover-1", previewUrl: "/preview/cover" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CreateCourseModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    const input = screen.getByLabelText("Upload course cover");
    fireEvent.change(input, { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });

    const remove = await screen.findByRole("button", { name: "Remove cover image" });
    expect(fetchMock).toHaveBeenCalledWith("/api/uploads", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
    fireEvent.click(remove);
    expect(screen.getByText("Choose an image")).toBeInTheDocument();
  });

  it("reports cover upload failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 415 })));
    render(<CreateCourseModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Upload course cover"), { target: { files: [new File(["x"], "bad.exe")] } });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("The cover image could not be uploaded."));
  });

  it("uploads materials, removes one, and creates the course", async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const uploaded = { uploadId: "file-1", fileName: "lesson.pdf", detectedMime: "application/pdf", fileType: "application/pdf", fileSize: 2048, scanStatus: "CLEAN", previewUrl: "/preview/file" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(uploaded), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "course-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CreateCourseModal open onClose={onClose} onCreated={onCreated} />);
    fireEvent.change(screen.getByPlaceholderText("Introduction to biology"), { target: { value: "  Cell biology  " } });
    fireEvent.click(screen.getByRole("button", { name: /Public/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Course description"), { target: { value: "  Cells and systems  " } });
    const materialInput = screen.getByLabelText(/Attach files/i);
    fireEvent.change(materialInput, { target: { files: [new File(["pdf"], "lesson.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("lesson.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "course-1" }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/courses", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ title: "Cell biology", description: "Cells and systems", coverUploadId: null, uploadIds: ["file-1"], visibility: "PUBLIC" }),
    }));
    expect(mocks.success).toHaveBeenCalledWith("Course created.");
    expect(onClose).toHaveBeenCalled();
  });

  it("continues after one material upload fails and can remove another", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ uploadId: "file-2", fileName: "notes.txt", fileSize: 10 }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CreateCourseModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Introduction to biology"), { target: { value: "Course" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText(/Attach files/i), {
      target: { files: [new File(["x"], "bad.exe"), new File(["x"], "notes.txt")] },
    });
    expect(await screen.findByText("notes.txt")).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith("bad.exe could not be uploaded.");
    fireEvent.click(screen.getByRole("button", { name: "Remove notes.txt" }));
    expect(screen.getByText("No materials attached")).toBeInTheDocument();
  });

  it("shows API and network errors when course creation fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Title already exists" }), { status: 409 }))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<CreateCourseModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Introduction to biology"), { target: { value: "Course" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Title already exists"));
    unmount();

    render(<CreateCourseModal open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Introduction to biology"), { target: { value: "Another" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("The course could not be created."));
  });
});
