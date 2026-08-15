import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateCourseModal } from "./CreateCourseModal";

vi.mock("@/components/ui/editor", () => ({
  Editor: ({ placeholder }: { placeholder: string }) => <textarea aria-label="Course description" placeholder={placeholder} />,
}));

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
});
