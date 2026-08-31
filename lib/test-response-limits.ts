export const TEST_SHORT_ANSWER_CHARACTER_LIMIT = 1_000;
export const TEST_ESSAY_CHARACTER_LIMIT = 6_000;
export const TEST_TOTAL_WRITTEN_CHARACTER_LIMIT = 12_000;
export const TEST_RESPONSE_REQUEST_BYTE_LIMIT = 64_000;

export const AI_GRADING_MAX_ESSAYS_PER_ATTEMPT = 10;
export const AI_GRADING_QUESTION_CHARACTER_LIMIT = 2_000;
export const AI_GRADING_TOTAL_CONTEXT_CHARACTER_LIMIT = 20_000;
export const AI_GRADING_BATCH_SIZE = 40;
export const AI_GRADING_BATCH_CONCURRENCY = 2;

export function writtenResponseLimit(questionType: string) {
  if (questionType === "SHORT_ANSWER") return TEST_SHORT_ANSWER_CHARACTER_LIMIT;
  if (questionType === "ESSAY") return TEST_ESSAY_CHARACTER_LIMIT;
  return null;
}

export function totalWrittenCharacters(responses: Array<{ responseText?: string | null }>) {
  return responses.reduce((total, response) => total + (response.responseText?.length ?? 0), 0);
}
