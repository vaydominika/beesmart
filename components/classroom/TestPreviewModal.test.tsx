import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestPreviewModal } from "./TestPreviewModal";

describe("TestPreviewModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "test-1",
      title: "Biology exam",
      description: "<p>Answer every question.</p>",
      type: "EXAM",
      timeLimit: 45,
      passingScore: 60,
      maxAttempts: 1,
      opensAt: null,
      closesAt: null,
      questions: [
        {
          id: "question-1",
          questionText: "Which organelle performs photosynthesis?",
          questionType: "MULTIPLE_CHOICE",
          points: 2,
          acceptedAnswers: null,
          options: [
            { id: "option-1", optionText: "Chloroplast", isCorrect: true },
            { id: "option-2", optionText: "Nucleus", isCorrect: false },
          ],
        },
      ],
    }))));
  });

  it("loads and presents assessment questions to classroom staff", async () => {
    render(<TestPreviewModal open onClose={vi.fn()} classroomId="class-1" testId="test-1" />);

    expect(await screen.findByRole("heading", { name: "Biology exam" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/classrooms/class-1/tests/test-1", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText("Which organelle performs photosynthesis?")).toBeInTheDocument();
    expect(screen.getByText("Chloroplast")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open grading dashboard" })).toHaveAttribute("href", "/classroom/class-1/tests/test-1");
  });
});
