import { describe, expect, it } from "vitest";
import { earlyAccessFeedbackEnabled, reportStatusLabel, reportTypeLabel } from "./ticket-types";

describe("ticket presentation helpers", () => {
  it("uses stable labels for ticket types and statuses", () => {
    expect(reportTypeLabel("COURSE_REPORT")).toBe("Course report");
    expect(reportTypeLabel("EARLY_ACCESS_FEEDBACK")).toBe("Early Access feedback");
    expect(reportTypeLabel("AUTOMATED_COURSE_FLAG")).toBe("Automated course flag");
    expect(reportStatusLabel("IN_PROGRESS")).toBe("In progress");
  });

  it("accepts explicit enabled values and defaults to disabled", () => {
    expect(earlyAccessFeedbackEnabled(undefined)).toBe(false);
    expect(earlyAccessFeedbackEnabled("TRUE")).toBe(true);
    expect(earlyAccessFeedbackEnabled("0")).toBe(false);
  });
});
