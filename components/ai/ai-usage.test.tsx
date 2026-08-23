import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiUsageStatus, useAiUsage } from "./ai-usage";

function UsageHarness() {
  const { usage, exhausted } = useAiUsage("SYLLABUS");
  return <><AiUsageStatus usage={usage} /><button disabled={exhausted}>Generate</button></>;
}

afterEach(() => vi.unstubAllGlobals());

describe("AI usage status", () => {
  it("shows the grading allowance before usage loads", () => {
    render(<AiUsageStatus usage={null} category="GRADING" />);
    expect(screen.getByRole("status")).toHaveTextContent("35 AI attempts left today");
  });

  it("loads the remaining allowance and disables generation at zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resetsAt: "2026-08-16T00:00:00.000Z",
        categories: {
          LESSON_CONTENT: { category: "LESSON_CONTENT", used: 0, remaining: 3, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" },
          SYLLABUS: { category: "SYLLABUS", used: 3, remaining: 0, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" },
          TEST_EXAM: { category: "TEST_EXAM", used: 0, remaining: 3, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" },
          GRADING: { category: "GRADING", used: 0, remaining: 35, limit: 35, resetsAt: "2026-08-16T00:00:00.000Z" },
        },
      }),
    }));

    render(<UsageHarness />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("0 AI attempts left today"));
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByLabelText(/Resets at/i)).toBeInTheDocument();
  });
});
