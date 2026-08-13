import { describe, expect, it } from "vitest";
import {
  DAILY_WELCOME_MESSAGES,
  dashboardCourseMatchesSearch,
  selectDailyWelcomeMessage,
} from "./dashboard";
import type { CourseCard } from "./types";

const course: CourseCard = {
  id: "course-1",
  title: "Cell Biology",
  description: "<p>Explore <strong>living systems</strong>.</p>",
  coverImageUrl: null,
  averageRating: null,
};

describe("dashboard helpers", () => {
  it("keeps every daily welcome message bee-themed", () => {
    expect(DAILY_WELCOME_MESSAGES.every((message) => /bee|hive|buzz/i.test(message))).toBe(true);
    expect(DAILY_WELCOME_MESSAGES.every((message) => !message.includes("—"))).toBe(true);
  });

  it("selects one stable approved welcome message for a user and local day", () => {
    const date = new Date(2026, 7, 9, 10, 30);
    const first = selectDailyWelcomeMessage("user-1", date);
    const second = selectDailyWelcomeMessage("user-1", new Date(2026, 7, 9, 23, 59));

    expect(second).toBe(first);
    expect(DAILY_WELCOME_MESSAGES).toContain(first);
  });

  it("uses the user and date as part of the daily message seed", () => {
    const selections = new Set([
      selectDailyWelcomeMessage("user-1", new Date(2026, 7, 9)),
      selectDailyWelcomeMessage("user-2", new Date(2026, 7, 9)),
      selectDailyWelcomeMessage("user-1", new Date(2026, 7, 10)),
      selectDailyWelcomeMessage("user-1", new Date(2026, 7, 11)),
    ]);

    expect(selections.size).toBeGreaterThan(1);
  });

  it("matches titles and plain text extracted from stored descriptions", () => {
    expect(dashboardCourseMatchesSearch(course, "biology")).toBe(true);
    expect(dashboardCourseMatchesSearch(course, "LIVING SYSTEMS")).toBe(true);
    expect(dashboardCourseMatchesSearch(course, "<strong>")).toBe(false);
    expect(dashboardCourseMatchesSearch(course, "geometry")).toBe(false);
  });
});
