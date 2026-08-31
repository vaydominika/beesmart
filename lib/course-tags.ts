export const MAX_COURSE_TAGS = 3;

export const COURSE_TAG_OPTIONS = [
  { value: "languages", label: "Languages" },
  { value: "mathematics", label: "Mathematics" },
  { value: "biology", label: "Biology" },
  { value: "chemistry", label: "Chemistry" },
  { value: "physics", label: "Physics" },
  { value: "computer-science", label: "Computer science" },
  { value: "history", label: "History" },
  { value: "geography", label: "Geography" },
  { value: "literature", label: "Literature" },
  { value: "arts", label: "Arts" },
  { value: "business-economics", label: "Business & economics" },
  { value: "health-wellbeing", label: "Health & wellbeing" },
] as const;

export type CourseTagSlug = (typeof COURSE_TAG_OPTIONS)[number]["value"];

const courseTagBySlug = new Map<CourseTagSlug, (typeof COURSE_TAG_OPTIONS)[number]>(
  COURSE_TAG_OPTIONS.map((tag) => [tag.value, tag]),
);

export function parseCourseTagSlugs(value: unknown): CourseTagSlug[] | null {
  if (!Array.isArray(value)) return null;
  const unique = Array.from(new Set(value));
  if (unique.length > MAX_COURSE_TAGS) return null;
  if (unique.some((slug) => typeof slug !== "string" || !courseTagBySlug.has(slug as CourseTagSlug))) return null;
  return unique as CourseTagSlug[];
}

export function courseTagDefinition(slug: CourseTagSlug) {
  return courseTagBySlug.get(slug)!;
}
