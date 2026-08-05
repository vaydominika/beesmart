import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseStatusFilter } from "./CourseStatusFilter";

describe("CourseStatusFilter", () => {
  it("shows the created-course options and selects a status", () => {
    const onCreatedChange = vi.fn();
    render(<CourseStatusFilter activeTab="created" learningFilter="all" createdFilter="all" onLearningChange={vi.fn()} onCreatedChange={onCreatedChange} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Publishing status: All courses" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Drafts" }));

    expect(onCreatedChange).toHaveBeenCalledWith("draft");
  });

  it("uses the learning options on the Learning tab", () => {
    const onLearningChange = vi.fn();
    render(<CourseStatusFilter activeTab="learning" learningFilter="in-progress" createdFilter="all" onLearningChange={onLearningChange} onCreatedChange={vi.fn()} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Learning status: In progress" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Completed" }));

    expect(onLearningChange).toHaveBeenCalledWith("completed");
  });
});
