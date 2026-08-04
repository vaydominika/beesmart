export interface PostAttachmentFile {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
}

export interface AssignmentDraft {
    title: string;
    description: string | null;
    dueDate: string;
    dueTime: string | null;
    isGraded: boolean;
    maxPoints: string | null;
    files: PostAttachmentFile[];
}

export interface TestQuestionDraft {
    questionText: string;
    questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
    points: number;
    options?: Array<{ optionText: string; isCorrect: boolean }>;
    correctAnswer: string | null;
}

export interface TestDraft {
    title: string;
    description: string | null;
    type: "TEST" | "EXAM";
    timeLimit: string | null;
    passingScore: string | null;
    opensAt: string | null;
    closesAt: string | null;
    questions: TestQuestionDraft[];
}
