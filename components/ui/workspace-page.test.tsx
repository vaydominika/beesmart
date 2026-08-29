import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LibraryToolbar, WorkspacePageFrame } from "@/components/ui/workspace-page";

describe("WorkspacePageFrame", () => {
  it("uses the same inset on every edge", () => {
    render(<WorkspacePageFrame data-testid="page-frame">Content</WorkspacePageFrame>);

    const frame = screen.getByTestId("page-frame");
    expect(frame).toHaveClass("p-4", "md:p-6");
    expect(frame).toHaveAttribute("data-slot", "workspace-page-frame");
    expect(frame.firstElementChild).toHaveAttribute("data-slot", "workspace-page-content");
    expect(screen.getByTestId("page-frame")).not.toHaveClass("px-4", "py-5", "md:px-6", "md:py-7");
  });
});

describe("LibraryToolbar", () => {
  it("uses a divider instead of an enclosing card", () => {
    render(
      <LibraryToolbar data-testid="library-toolbar">
        <button type="button">Filter</button>
      </LibraryToolbar>,
    );

    const toolbar = screen.getByTestId("library-toolbar");

    expect(toolbar).toHaveClass(
      "border-b",
      "border-[var(--app-border)]",
      "pb-4",
    );
    expect(toolbar).not.toHaveClass(
      "rounded-2xl",
      "border",
      "bg-[var(--app-surface)]",
      "p-3",
    );
  });
});
