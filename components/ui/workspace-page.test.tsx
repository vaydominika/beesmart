import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LibraryToolbar } from "@/components/ui/workspace-page";

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
