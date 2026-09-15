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
    const generate = screen.getByRole("button", { name: "Create questions" });

    expect(generate).toBeDisabled();
    expect(screen.getByText("Paste at least 50 characters.")).toBeInTheDocument();

    fireEvent.change(source, { target: { value: "Short source" } });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);
    expect(mocks.toastError).toHaveBeenCalledWith("Paste at least 50 characters of source text.");

    fireEvent.change(source, { target: { value: "x".repeat(50) } });
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("uses attached files in text AI generation without adding them to the exam", async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/tests/generate-from-text") && init?.method === "POST") {
        return new Response(JSON.stringify({
          test: {
            title: "Generated biology exam",
            questions: [{ text: "What does photosynthesis produce?", type: "SHORT_ANSWER", points: 1, correctAnswer: "Chemical energy" }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
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

    fireEvent.click(screen.getByRole("tab", { name: "Exam" }));
    fireEvent.click(screen.getByRole("tab", { name: "Text" }));
    expect(screen.getByRole("button", { name: "Attach files" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Choose source files"), {
      target: { files: [
        new File(["photosynthesis source material"], "reference.txt", { type: "text/plain" }),
        new File(["plant cell notes"], "notes.txt", { type: "text/plain" }),
      ] },
    });
    expect(screen.getByText("reference.txt")).toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText(/used only to create questions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create questions" }));
    await waitFor(() => expect(screen.getByPlaceholderText("e.g. Midterm Exam")).toHaveValue("Generated biology exam"));

    fireEvent.click(screen.getByRole("button", { name: "Attach exam to post" }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: "Generated biology exam",
      type: "EXAM",
      questions: [expect.objectContaining({ questionText: "What does photosynthesis produce?" })],
    }));
    expect(onAdd.mock.calls[0][0]).not.toHaveProperty("files");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/uploads", expect.anything());
    const generationCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/tests/generate-from-text"));
    expect(generationCall?.[1]?.body).toBeInstanceOf(FormData);
    expect((generationCall?.[1]?.body as FormData).getAll("files").map((entry) => (entry as File).name)).toEqual(["reference.txt", "notes.txt"]);
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
    fireEvent.click(screen.getByRole("button", { name: "Create questions" }));

    await waitFor(() => expect(screen.getByPlaceholderText("e.g. Midterm Exam")).toHaveValue("Generated biology quiz"));
    expect(description).toHaveValue("Review chapters one and two.");
    const generationCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/tests/generate-from-text"));
    expect(generationCall?.[1]?.body).toBeInstanceOf(FormData);
    expect((generationCall?.[1]?.body as FormData).has("description")).toBe(false);
  });
});
