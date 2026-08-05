import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassroomDestinationSelect } from "./ClassroomDestinationSelect";

const classrooms = [
  { id: "classroom-1", name: "Matematika" },
  { id: "classroom-2", name: "Biology" },
];

describe("ClassroomDestinationSelect", () => {
  it("opens a styled destination menu and selects a classroom", () => {
    const onChange = vi.fn();
    render(<ClassroomDestinationSelect classrooms={classrooms} value="classroom-1" onChange={onChange} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Destination classroom: Matematika" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Biology" }));

    expect(onChange).toHaveBeenCalledWith("classroom-2");
  });

  it("shows a disabled empty state when no destination exists", () => {
    render(<ClassroomDestinationSelect classrooms={[]} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Destination classroom: No classrooms available" })).toBeDisabled();
  });
});
