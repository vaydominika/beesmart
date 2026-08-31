export interface PostAttachmentFile {
    uploadId: string;
    fileName: string;
    detectedMime: string;
    fileType: string;
    fileSize: number;
    scanStatus: string;
    previewUrl: string;
}

export interface AssignmentDraft {
    title: string;
    description: string | null;
    dueDate: string;
    dueTime: string | null;
    timeZone: string;
    isGraded: boolean;
    maxPoints: string | null;
    files: PostAttachmentFile[];
}

export function assignmentDescriptionPostContent(description: string | null): string {
    if (!description) return "";
    const escaped = description
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    return escaped
        .split(/\r?\n/)
        .map((line) => `<p>${line || "<br>"}</p>`)
        .join("");
}

export interface TestQuestionDraft {
    questionText: string;
    questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
    points: number;
    options?: Array<{ optionText: string; isCorrect: boolean }>;
    correctAnswer: string | null;
    acceptedAnswers?: string[];
}

export interface TestDraft {
    sourceCourseId?: string | null;
    title: string;
    description: string | null;
    type: "TEST" | "EXAM";
    timeLimit: string | null;
    passingScore: string | null;
    opensAt: string | null;
    closesAt: string | null;
    maxAttempts: number;
    questions: TestQuestionDraft[];
}
