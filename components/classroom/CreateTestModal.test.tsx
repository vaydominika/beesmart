import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTestModal } from "./CreateTestModal";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("@/components/ai/ai-usage", () => ({
  AiUsageStatus: () => <p>3 AI attempts left today</p>,
  useAiUsage: () => ({
    usage: null,
    exhausted: false,
    refresh: vi.fn(),
    syncFromResponse: vi.fn(),
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

describe("CreateTestModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    ));
  });

  it("explains the text minimum and lets a non-empty source report validation feedback", () => {
    render(
      <CreateTestModal
        open
        classroomId="class-1"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Text" }));
    const source = screen.getByRole("textbox", { name: "Source text" });
    const generate = screen.getByRole("button", { name: "Generate" });

    expect(generate).toBeDisabled();
    expect(screen.getByText("50 more characters required")).toBeInTheDocument();

    fireEvent.change(source, { target: { value: "Short source" } });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);
    expect(mocks.toastError).toHaveBeenCalledWith("Paste at least 50 characters of source text.");

    fireEvent.change(source, { target: { value: "x".repeat(50) } });
    expect(screen.getByText("Ready to generate")).toBeInTheDocument();
  });

  it("uploads files and includes them in a valid exam draft", async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const uploadedFile = {
      uploadId: "upload-1",
      fileName: "reference.pdf",
      detectedMime: "application/pdf",
      fileType: "DOCUMENT",
      fileSize: 2048,
      scanStatus: "CLEAN",
      previewUrl: "/api/files/upload-1",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/uploads" && init?.method === "POST") {
        return new Response(JSON.stringify(uploadedFile), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CreateTestModal
        open
        classroomId="class-1"
        onAdd={onAdd}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Midterm Exam"), {
      target: { value: "Biology exam" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Exam" }));
    fireEvent.change(screen.getByLabelText("Add files"), {
      target: { files: [new File(["reference"], "reference.pdf", { type: "application/pdf" })] },
    });
    expect(await screen.findByText("reference.pdf")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Enter your question..."), {
      target: { value: "What does photosynthesis produce?" },
    });
    fireEvent.change(screen.getByPlaceholderText("Option 1"), {
      target: { value: "Chemical energy" },
    });
    fireEvent.change(screen.getByPlaceholderText("Option 2"), {
      target: { value: "Sound" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Attach exam to post" }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: "Biology exam",
      type: "EXAM",
      files: [uploadedFile],
      questions: [expect.objectContaining({ questionText: "What does photosynthesis produce?" })],
    }));
    const uploadCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/uploads");
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
    expect((uploadCall?.[1]?.body as FormData).get("purpose")).toBe("POST_ATTACHMENT");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Exam attached. Publish the post to create it.");
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps a manually entered description when generating a draft", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/courses?source=all") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (String(input).endsWith("/tests/generate-from-text") && init?.method === "POST") {
        return new Response(JSON.stringify({
          test: {
            title: "Generated biology quiz",
            description: "This value must be ignored",
            questions: [{ text: "What do plants convert?", type: "SHORT_ANSWER", points: 1, correctAnswer: "Light energy" }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CreateTestModal
        open
        classroomId="class-1"
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const description = screen.getByPlaceholderText("Instructions...");
    fireEvent.change(description, { target: { value: "Review chapters one and two." } });
    fireEvent.click(screen.getByRole("tab", { name: "Text" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Source text" }), { target: { value: "x".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(screen.getByPlaceholderText("e.g. Midterm Exam")).toHaveValue("Generated biology quiz"));
    expect(description).toHaveValue("Review chapters one and two.");
    const generationCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/tests/generate-from-text"));
    expect(JSON.parse(String(generationCall?.[1]?.body))).not.toHaveProperty("description");
  });
});
