export type ScoringQuestion = {
    id: string;
    questionType: string;
    points: number;
    options: Array<{ id: string; isCorrect: boolean }>;
    answers: Array<{ answerText: string | null }>;
};

export type ScoringResponse = {
    questionId: string;
    responseText?: string | null;
    selectedOptionId?: string | null;
    pointsAwarded?: number | null;
};

export function normalizeShortAnswer(value: string) {
    return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function scoreAutomaticResponse(question: ScoringQuestion, response?: ScoringResponse) {
    if (!response) return { isCorrect: false, pointsAwarded: 0, needsManualGrading: false };

    if (question.questionType === "MULTIPLE_CHOICE" || question.questionType === "TRUE_FALSE") {
        const selected = question.options.find((option) => option.id === response.selectedOptionId);
        const isCorrect = Boolean(selected?.isCorrect);
        return { isCorrect, pointsAwarded: isCorrect ? question.points : 0, needsManualGrading: false };
    }

    if (question.questionType === "SHORT_ANSWER") {
        const learnerAnswer = normalizeShortAnswer(response.responseText ?? "");
        const acceptedAnswers = question.answers
            .map((answer) => answer.answerText ? normalizeShortAnswer(answer.answerText) : "")
            .filter(Boolean);
        const isCorrect = learnerAnswer.length > 0 && acceptedAnswers.includes(learnerAnswer);
        return { isCorrect, pointsAwarded: isCorrect ? question.points : 0, needsManualGrading: false };
    }

    const answered = Boolean(response.responseText?.trim());
    return {
        isCorrect: answered ? null : false,
        pointsAwarded: answered ? null : 0,
        needsManualGrading: answered,
    };
}

export function calculateAttemptTotals(
    questions: Array<Pick<ScoringQuestion, "id" | "points">>,
    responses: Array<Pick<ScoringResponse, "questionId" | "pointsAwarded">>,
) {
    const pointsByQuestion = new Map(responses.map((response) => [response.questionId, response.pointsAwarded ?? 0]));
    const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
    const totalScore = questions.reduce((sum, question) => sum + (pointsByQuestion.get(question.id) ?? 0), 0);
    return { totalPoints, totalScore, percentage: totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0 };
}
