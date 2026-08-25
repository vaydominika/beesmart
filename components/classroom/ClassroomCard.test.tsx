import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassroomCard } from "./ClassroomCard";

describe("ClassroomCard", () => {
  it("uses the shared neutral card border", () => {
    render(
      <ClassroomCard
        id="classroom-1"
        name="Biology"
        code="BEE123"
        role="TEACHER"
        memberCount={2}
        onClick={vi.fn()}
      />,
    );

    const card = screen.getByRole("button", { name: /Biology/i });
    expect(card).toHaveClass("border-[var(--app-border)]", "hover:border-[var(--classroom-line-strong)]");
    expect(card).not.toHaveClass("border-(--classroom-accent)");
  });
});
