import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceCheckbox } from "./workspace-checkbox";
import { WorkspaceSelect } from "./workspace-select";
import { WorkspaceTabs } from "./workspace-tabs";

describe("workspace controls", () => {
  it("changes a checkbox through its label", () => {
    const onCheckedChange = vi.fn();
    render(<WorkspaceCheckbox label="Personal" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Personal" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("selects an accessible tab", () => {
    const onValueChange = vi.fn();
    const items = [{ value: "week", label: "Week" }, { value: "month", label: "Month" }] as const;
    const { rerender, container } = render(<WorkspaceTabs ariaLabel="Calendar view" value="week" onValueChange={onValueChange} items={items} />);
    expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Month" }));
    expect(onValueChange).toHaveBeenCalledWith("month");
    rerender(<WorkspaceTabs ariaLabel="Calendar view" value="month" onValueChange={onValueChange} items={items} />);
    expect(container.querySelector('[data-slot="workspace-tabs-indicator"]')).toHaveStyle({ transform: "translateX(100%)" });
  });

  it("opens a select and changes its value", () => {
    const onValueChange = vi.fn();
    render(<WorkspaceSelect ariaLabel="Visibility" value="private" onValueChange={onValueChange} options={[{ value: "private", label: "Private" }, { value: "public", label: "Public" }]} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Visibility: Private" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Public" }));
    expect(onValueChange).toHaveBeenCalledWith("public");
  });
});
