export const COURSE_TITLE_MAX_LENGTH = 150;
export const COURSE_TITLE_DISPLAY_LENGTH = 45;

export function displayCourseTitle(title: string) {
  return title.length > COURSE_TITLE_DISPLAY_LENGTH
    ? `${title.slice(0, COURSE_TITLE_DISPLAY_LENGTH)}...`
    : title;
}

export function normalizeCourseTitle(value: unknown) {
  if (typeof value !== "string") return null;

  const title = value.trim();
  if (!title || title.length > COURSE_TITLE_MAX_LENGTH) return null;

  return title;
}
