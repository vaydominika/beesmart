import { fireEvent, render as testingRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CourseViewerClient from "./CourseViewerClient";
import { TooltipProvider } from "@/components/ui/tooltip";

const render = (ui: ReactElement) => testingRender(ui, { wrapper: TooltipProvider });

const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/course/CourseRatingModal", () => ({ CourseRatingModal: () => null }));

const course = {
  id: "course-1",
  title: "Numerical Analysis II",
  modules: [{
    id: "module-1",
    title: "Foundations",
    lessons: [
      { id: "lesson-1", title: "Introduction", content: "<h2>Learning objectives</h2><p>Understand numerical methods.</p>", isLocked: true },
      { id: "lesson-2", title: "Error analysis", content: "<h2>Errors</h2><p>Measure approximation error.</p>", isLocked: false },
    ],
  }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("CourseViewerClient", () => {
  it("renders the redesigned reader and unlocks the next prerequisite after completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<CourseViewerClient course={course} initialLessonId="lesson-1" />);

    expect(screen.getByRole("heading", { name: "Syllabus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Numerical Analysis II" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Introduction" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learning objectives" })).toBeInTheDocument();
    const backControl = screen.getByRole("link", { name: "Back to course overview" });
    expect(backControl).toHaveAttribute("data-size", "icon-compact");
    expect(screen.getByRole("heading", { name: "Syllabus" }).parentElement?.parentElement).toContainElement(backControl);
    expect(screen.getByRole("heading", { name: "Numerical Analysis II" }).closest("header")).not.toContainElement(backControl);
    expect(screen.getByRole("button", { name: "Introduction" })).toHaveClass(
      "bg-[var(--course-surface-muted)]",
      "border-[var(--course-line)]",
    );
    expect(screen.getByRole("heading", { name: "Introduction" }).closest("article")).toHaveClass("shadow-none", "rounded-xl");

    fireEvent.click(screen.getByRole("button", { name: "Error analysis" }));
    expect(screen.getByRole("heading", { name: "Complete the earlier prerequisites" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Introduction" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete & continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/courses/course-1/lessons/lesson-1/progress",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ completed: true }) }),
    ));
    expect(await screen.findByRole("heading", { name: "Error analysis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Errors" })).toBeInTheDocument();
    expect(screen.getByText("1 of 2 complete")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
