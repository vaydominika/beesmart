import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReminderItem } from "./ReminderItem";

describe("ReminderItem", () => {
  it("renders the task, date, and optional time", () => {
    const { rerender } = render(<ReminderItem task="Review notes" date="Tomorrow" time="09:30" />);
    expect(screen.getByText("Review notes")).toBeVisible();
    expect(screen.getByText("Tomorrow")).toBeVisible();
    expect(screen.getByText("09:30")).toBeVisible();
    rerender(<ReminderItem task="All-day reminder" date="Friday" time="" />);
    expect(screen.queryByText("09:30")).not.toBeInTheDocument();
  });
});
