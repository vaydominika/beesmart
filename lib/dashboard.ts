import type { CourseCard } from "@/lib/types";
import { plainTextExcerpt } from "@/lib/course-summary";

export const DAILY_WELCOME_MESSAGES = [
  "Things just weren’t the same without your bee-autiful presence!",
  "The hive is buzzing again now that you’re back!",
  "Your next bee-rilliant idea has been waiting for you!",
  "Welcome back, let’s make today un-bee-lievable!",
  "The hive saved your spot. Let’s get buzzing!",
  "A fresh day, a fresh chance to bee curious!",
  "Great to see you again. Let’s bee-gin where you left off!",
] as const;

export const FIRST_LOGIN_WELCOME_MESSAGE =
  "Your learning hive is ready. Explore a course or create one of your own!";

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function selectDailyWelcomeMessage(userId: string, date = new Date()): string {
  const seed = `${userId}|${localDateKey(date)}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return DAILY_WELCOME_MESSAGES[(hash >>> 0) % DAILY_WELCOME_MESSAGES.length];
}

export function dashboardCourseMatchesSearch(course: CourseCard, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [course.title, plainTextExcerpt(course.description)].some((value) =>
    value.toLocaleLowerCase().includes(query),
  );
}
