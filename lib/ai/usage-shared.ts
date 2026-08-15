export const AI_DAILY_LIMIT = 3;
export const AI_SOURCE_CHARACTER_LIMIT = 12_000;
export const AI_LESSON_PROMPT_CHARACTER_LIMIT = 2_000;

export const AI_USAGE_CATEGORIES = ["LESSON_CONTENT", "SYLLABUS", "TEST_EXAM"] as const;
export type AiUsageCategory = (typeof AI_USAGE_CATEGORIES)[number];

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
