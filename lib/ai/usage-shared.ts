export const AI_DAILY_LIMIT = 3;
export const AI_GRADING_DAILY_LIMIT = 35;
export const AI_SOURCE_CHARACTER_LIMIT = 12_000;
export const AI_LESSON_PROMPT_CHARACTER_LIMIT = 2_000;

export const AI_USAGE_CATEGORIES = ["LESSON_CONTENT", "SYLLABUS", "TEST_EXAM", "GRADING"] as const;
export type AiUsageCategory = (typeof AI_USAGE_CATEGORIES)[number];

export const AI_CATEGORY_DAILY_LIMITS: Record<AiUsageCategory, number> = {
  LESSON_CONTENT: AI_DAILY_LIMIT,
  SYLLABUS: AI_DAILY_LIMIT,
  TEST_EXAM: AI_DAILY_LIMIT,
  GRADING: AI_GRADING_DAILY_LIMIT,
};

export function aiDailyLimitFor(category: AiUsageCategory) {
  return AI_CATEGORY_DAILY_LIMITS[category];
}

export interface AiUsageState {
  category: AiUsageCategory;
  used: number;
  remaining: number;
  limit: number;
  resetsAt: string;
}

export interface AiUsageResponse {
  categories: Record<AiUsageCategory, AiUsageState>;
  resetsAt: string;
}

export const AI_USAGE_HEADER_LIMIT = "X-AI-Limit";
export const AI_USAGE_HEADER_REMAINING = "X-AI-Remaining";
export const AI_USAGE_HEADER_RESET = "X-AI-Reset-At";
export const AI_USAGE_HEADER_CATEGORY = "X-AI-Category";
