import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarWidget } from "./CalendarWidget";

describe("CalendarWidget controls", () => {
  it("uses a high-contrast neutral pressed state instead of yellow", () => {
    render(<CalendarWidget />);

    for (const button of [
      screen.getByRole("button", { name: "Previous month" }),
      screen.getByRole("button", { name: "Today" }),
      screen.getByRole("button", { name: "Next month" }),
    ]) {
      expect(button).toHaveClass("active:bg-[var(--app-text)]");
      expect(button).toHaveClass("active:text-[var(--app-text-inverse)]");
      expect(button).not.toHaveClass("active:bg-[var(--app-accent-soft)]");
    }
  });
});
