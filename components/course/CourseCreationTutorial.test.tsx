import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseCreationTutorial } from "./CourseCreationTutorial";

describe("CourseCreationTutorial", () => {
  it("requires the reader to move through every step before finishing", async () => {
    const onFinish = vi.fn().mockResolvedValue(true);
    render(<CourseCreationTutorial open intent="create" onClose={vi.fn()} onFinish={onFinish} />);

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Course setup basics screen/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Course setup details screen/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue to course setup" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Syllabus builder with outline generation, modules, and lessons/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Lesson editor with options to create content/ })).toBeInTheDocument();
    expect(screen.getByText(/Each AI creation tool has 3 attempts per day/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: "Continue to course setup" }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  });

  it("supports reviewing the guide without presenting course creation as the outcome", () => {
    render(<CourseCreationTutorial open intent="review" onClose={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("img", { name: /Course builder saving changes before publishing/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Publication safety check running before the course is published/ })).toBeInTheDocument();
    expect(screen.getByText("Save, then publish")).toBeInTheDocument();
    expect(screen.getByText(/audit checks it before it officially goes live/i)).toBeInTheDocument();
    expect(screen.queryByText("Audit")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish review" })).toBeInTheDocument();
  });

  it("returns to the first step when the tutorial is closed", () => {
    const onClose = vi.fn();
    const { rerender } = render(<CourseCreationTutorial open intent="review" onClose={onClose} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Close tutorial" }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<CourseCreationTutorial open intent="review" onClose={onClose} onFinish={vi.fn()} />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });
});
