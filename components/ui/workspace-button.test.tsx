import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceButton, workspaceButtonVariants } from "./workspace-button";

describe("WorkspaceButton", () => {
  it.each(["primary", "secondary", "danger", "ghost"] as const)("renders the %s variant", (variant) => {
    render(<WorkspaceButton variant={variant}>{variant}</WorkspaceButton>);
    const button = screen.getByRole("button", { name: variant });
    expect(button).toHaveAttribute("data-variant", variant);
    expect(button).toHaveClass("h-9", "rounded-xl");
  });

  it.each([
    ["compact", "h-8", "rounded-lg"],
    ["icon", "h-9", "w-9"],
    ["icon-compact", "h-8", "w-8"],
  ] as const)("renders the %s size", (size, height, shape) => {
    render(<WorkspaceButton size={size} aria-label={size} />);
    expect(screen.getByRole("button", { name: size })).toHaveClass(height, shape);
  });

  it("supports links through asChild", () => {
    render(<WorkspaceButton asChild variant="primary"><a href="https://example.com/courses">Courses</a></WorkspaceButton>);
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("data-slot", "workspace-button");
  });

  it("uses a neutral high-contrast pressed state for secondary actions", () => {
    render(<WorkspaceButton variant="secondary">Previous</WorkspaceButton>);
    const button = screen.getByRole("button", { name: "Previous" });
    expect(button).toHaveClass("active:bg-[var(--app-text)]", "active:text-[var(--app-text-inverse)]");
    expect(button).not.toHaveClass("active:bg-[var(--app-accent-soft)]");
  });

  it("preserves disabled behavior and custom classes", () => {
    const onClick = vi.fn();
    render(<WorkspaceButton disabled onClick={onClick} className="w-full">Save</WorkspaceButton>);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveClass("w-full", "disabled:opacity-100");
  });

  it("exports styles for link and upload-label triggers", () => {
    expect(workspaceButtonVariants({ variant: "primary", size: "compact" })).toContain("h-8");
  });
});
