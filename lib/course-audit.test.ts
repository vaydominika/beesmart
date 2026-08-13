import { describe, expect, it } from "vitest";
import { courseAuditSchema } from "./course-audit";

describe("courseAuditSchema", () => {
  it("accepts null lesson references for course-wide findings", () => {
    const result = courseAuditSchema.safeParse({
      overallScore: 40,
      summary: "The course needs more content.",
      strengths: [],
      qualityIssues: [
        {
          lessonId: null,
          severity: "HIGH",
          issue: "The course structure is incomplete.",
          suggestion: "Add distinct modules and learning objectives.",
        },
      ],
      safetyFlags: [
        {
          lessonId: null,
          contentSnippet: "Course-wide finding",
          reason: "The concern is not tied to one lesson.",
        },
      ],
      accessibilityScore: 20,
    });

    expect(result.success).toBe(true);
  });

  it("still accepts exact lesson IDs and omitted references", () => {
    const result = courseAuditSchema.safeParse({
      overallScore: 80,
      summary: "Mostly complete.",
      strengths: ["Clear structure"],
      qualityIssues: [
        {
          lessonId: "lesson-1",
          severity: "LOW",
          issue: "One example is unclear.",
          suggestion: "Clarify the example.",
        },
        {
          severity: "MEDIUM",
          issue: "The course needs an assessment.",
          suggestion: "Add a final quiz.",
        },
      ],
      safetyFlags: [],
      accessibilityScore: 75,
    });

    expect(result.success).toBe(true);
  });
});
