import { describe, expect, it } from "vitest";
import { calculateAttemptTotals, normalizeShortAnswer, scoreAutomaticResponse, type ScoringQuestion } from "./test-scoring";

const shortQuestion: ScoringQuestion = {
    id: "short-1",
    questionType: "SHORT_ANSWER",
    points: 3,
    options: [],
    answers: [{ answerText: "Honey bee" }, { answerText: "Apis mellifera" }],
};

describe("test scoring", () => {
    it("normalizes Unicode, case, and whitespace without fuzzy matching", () => {
        expect(normalizeShortAnswer("  HONEY\t BEE ")).toBe("honey bee");
        expect(normalizeShortAnswer("ＡＰＩＳ Mellifera")).toBe("apis mellifera");
    });

    it("awards a normalized exact match against any accepted answer", () => {
        expect(scoreAutomaticResponse(shortQuestion, { questionId: shortQuestion.id, responseText: "  apis   MELLIFERA " }))
            .toEqual({ isCorrect: true, pointsAwarded: 3, needsManualGrading: false });
        expect(scoreAutomaticResponse(shortQuestion, { questionId: shortQuestion.id, responseText: "Apis melifera" }).pointsAwarded)
            .toBe(0);
    });

    it("treats unanswered essays as zero without manual review", () => {
        expect(scoreAutomaticResponse({ ...shortQuestion, questionType: "ESSAY" }, undefined))
            .toEqual({ isCorrect: false, pointsAwarded: 0, needsManualGrading: false });
    });

    it("keeps every question in the denominator", () => {
        expect(calculateAttemptTotals(
            [{ id: "q1", points: 2 }, { id: "q2", points: 3 }],
            [{ questionId: "q1", pointsAwarded: 2 }],
        )).toEqual({ totalPoints: 5, totalScore: 2, percentage: 40 });
    });
});
