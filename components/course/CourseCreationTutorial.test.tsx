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
    expect(screen.getByRole("img", { name: /Syllabus builder with the outline generator/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Syllabus builder with a module and lesson/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Lesson editor with options to create content/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: "Continue to course setup" }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  });

  it("supports reviewing the guide without presenting course creation as the outcome", () => {
    render(<CourseCreationTutorial open intent="review" onClose={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Publication safety check")).toBeInTheDocument();
    expect(screen.getByText("Save, check the learner view, then publish")).toBeInTheDocument();
    expect(screen.getByText(/safety check runs automatically every time/i)).toBeInTheDocument();
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
