import { describe, expect, it } from "vitest";
import { courseTagDefinition, parseCourseTagSlugs } from "./course-tags";

describe("course tags", () => {
  it("accepts predefined tags and removes duplicates", () => {
    expect(parseCourseTagSlugs(["biology", "history", "biology"])).toEqual(["biology", "history"]);
    expect(courseTagDefinition("biology")).toEqual({ value: "biology", label: "Biology" });
  });

  it("rejects malformed, unknown, and oversized selections", () => {
    expect(parseCourseTagSlugs("biology")).toBeNull();
    expect(parseCourseTagSlugs(["unknown"])).toBeNull();
    expect(parseCourseTagSlugs(["biology", "chemistry", "physics", "history"])).toBeNull();
  });
});
