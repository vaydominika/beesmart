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

  it("uses a soft-square hover and a double-keyline selected day", () => {
    const selectedDate = new Date();
    selectedDate.setDate(15);
    render(<CalendarWidget selectedDate={selectedDate} />);

    const selectedDay = screen.getByRole("button", { name: "15", pressed: true });
    const hoverDay = screen.getByRole("button", { name: selectedDate.getDate() === 14 ? "16" : "14" });

    expect(selectedDay).toHaveClass(
      "rounded-[9px]",
      "bg-(--theme-text)",
      "text-(--theme-sidebar)",
      "ring-2",
      "ring-offset-1",
    );
    expect(hoverDay).toHaveClass("rounded-[9px]", "hover:bg-(--theme-text)/10", "hover:-translate-y-px");
  });
});
