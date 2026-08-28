import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceCheckbox } from "./workspace-checkbox";
import { WorkspaceSelect } from "./workspace-select";
import { WorkspaceTabs } from "./workspace-tabs";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

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
    const trigger = screen.getByRole("button", { name: "Visibility: Private" });
    expect(trigger).toHaveAttribute("data-slot", "workspace-select-trigger");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    const option = screen.getByRole("menuitem", { name: "Public" });
    expect(option.closest('[data-slot="dropdown-menu-content"]')).toHaveClass("z-[1100]");
    fireEvent.click(option);
    expect(onValueChange).toHaveBeenCalledWith("public");
  });

  it("renders popovers above dialogs and page content", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open filters</PopoverTrigger>
        <PopoverContent>Filter options</PopoverContent>
      </Popover>,
    );

    expect(screen.getByText("Filter options")).toHaveClass("z-[1100]");
  });

  it("changes a select nested inside a modal dialog", () => {
    const onValueChange = vi.fn();
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Report course</DialogTitle>
          <WorkspaceSelect ariaLabel="Report reason" value="" onValueChange={onValueChange} options={[{ value: "", label: "Select a reason", disabled: true }, { value: "spam", label: "Spam or advertising" }]} />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "dialog-content");

    fireEvent.pointerDown(screen.getByRole("button", { name: "Report reason: Select a reason" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Spam or advertising" }));
    expect(onValueChange).toHaveBeenCalledWith("spam");
  });
});
