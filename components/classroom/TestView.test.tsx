import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestView } from "./TestView";

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: mocks }));
vi.mock("@/components/ai/ai-usage", () => ({
    useAiUsage: () => ({ usage: null, exhausted: false, syncFromResponse: vi.fn() }),
    AiUsageStatus: () => <div role="status">AI allowance</div>,
}));

afterEach(() => vi.unstubAllGlobals());

describe("TestView learner lifecycle", () => {
    it("loads metadata without creating an attempt and starts only after the learner confirms", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                id: "test-1", title: "Bee biology", description: "Read every question.", type: "TEST",
                timeLimit: null, passingScore: 50, opensAt: null, closesAt: null, maxAttempts: 2, questions: [],
                attemptPolicy: { maxAttempts: 2, completedAttempts: 0, remainingAttempts: 2, activeAttemptId: null, nextAttemptNumber: 1, canStart: true },
                attemptHistory: [], bestAttempt: null,
            }), { status: 200, headers: { "Content-Type": "application/json" } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                attempt: { id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: new Date().toISOString(), submittedAt: null, isCompleted: false, score: null },
                responses: [],
                test: {
                    id: "test-1", title: "Bee biology", description: "Read every question.", type: "TEST", timeLimit: null,
                    passingScore: 50, maxAttempts: 2,
                    questions: [{ id: "question-1", questionText: "What do bees collect?", questionType: "SHORT_ANSWER", points: 1, options: [] }],
                },
            }), { status: 201, headers: { "Content-Type": "application/json" } }));
        vi.stubGlobal("fetch", fetchMock);

        render(<TestView classroomId="class-1" testId="test-1" isTeacher={false} />);
        const start = await screen.findByRole("button", { name: /Start attempt 1 of 2/i });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/classrooms/class-1/tests/test-1");

        fireEvent.click(start);
        await screen.findByText("What do bees collect?");
        expect(screen.getByPlaceholderText("Write your answer here...")).toHaveAttribute("maxlength", "1000");
        expect(screen.getByText("0 / 1,000 characters")).toBeInTheDocument();
        await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/classrooms/class-1/tests/test-1/start", { method: "POST" }));
    });

    it("shows a safe load error and retries successfully", async () => {
        const metadata = {
            id: "test-1", title: "Recovered test", type: "TEST", maxAttempts: 1, questions: [],
            attemptPolicy: { maxAttempts: 1, completedAttempts: 0, remainingAttempts: 1, activeAttemptId: null, nextAttemptNumber: 1, canStart: true },
            attemptHistory: [], bestAttempt: null,
        };
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Temporary outage" }), { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(metadata), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        render(<TestView classroomId="class-1" testId="test-1" isTeacher={false} />);
        expect(await screen.findByRole("heading", { name: "Assessment unavailable" })).toBeInTheDocument();
        expect(screen.getByText("Temporary outage")).toBeInTheDocument();
        expect(mocks.error).toHaveBeenCalledWith("Temporary outage");
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByRole("heading", { name: "Recovered test" })).toBeInTheDocument();
    });

    it("reports a failed attempt start without leaving the pre-test screen", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                id: "test-1", title: "Quiz", type: "TEST", maxAttempts: 1, questions: [],
                attemptPolicy: { maxAttempts: 1, completedAttempts: 0, remainingAttempts: 1, activeAttemptId: null, nextAttemptNumber: 1, canStart: true },
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Test is closed" }), { status: 409 }));
        vi.stubGlobal("fetch", fetchMock);
        render(<TestView classroomId="class-1" testId="test-1" isTeacher={false} />);
        fireEvent.click(await screen.findByRole("button", { name: /Start attempt/i }));
        await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Test is closed"));
        expect(screen.getByRole("heading", { name: "Ready to begin?" })).toBeInTheDocument();
    });

    it("restores a draft, saves an edited answer, and submits it", async () => {
        const now = new Date().toISOString();
        const question = { id: "question-1", questionText: "Explain pollination", questionType: "ESSAY", points: 5, options: [] };
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                id: "test-1", title: "Bee biology", type: "TEST", timeLimit: null, maxAttempts: 2, questions: [],
                attemptPolicy: { maxAttempts: 2, completedAttempts: 0, remainingAttempts: 2, activeAttemptId: "attempt-1", nextAttemptNumber: 1, canStart: true },
                attemptHistory: [], bestAttempt: null,
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                attempt: { id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: now, isCompleted: false },
                responses: [{ questionId: "question-1", responseText: "Saved draft" }],
                test: { id: "test-1", title: "Bee biology", type: "TEST", timeLimit: null, maxAttempts: 2, questions: [question] },
            }), { status: 201 }))
            .mockResolvedValueOnce(new Response("{}", { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                attempt: { id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: now, submittedAt: now, isCompleted: true, score: null },
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                id: "test-1", title: "Bee biology", type: "TEST", timeLimit: null, maxAttempts: 2, questions: [],
                attemptPolicy: { maxAttempts: 2, completedAttempts: 1, remainingAttempts: 1, activeAttemptId: null, nextAttemptNumber: 2, canStart: true },
                attemptHistory: [{ id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: now, submittedAt: now, isCompleted: true, score: null }],
                bestAttempt: null,
                resultReview: [],
            }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        render(<TestView classroomId="class-1" testId="test-1" isTeacher={false} />);
        fireEvent.click(await screen.findByRole("button", { name: /Resume attempt/i }));
        const answer = await screen.findByPlaceholderText("Write your answer here...");
        expect(answer).toHaveValue("Saved draft");
        fireEvent.change(answer, { target: { value: "Improved answer" } });
        fireEvent.click(screen.getByRole("button", { name: /Submit Exam/i }));

        expect(await screen.findByRole("heading", { name: "Test Submitted" })).toBeInTheDocument();
        expect(screen.getByText(/pending review/i)).toBeInTheDocument();
        expect(mocks.success).toHaveBeenCalledWith("Test submitted successfully!");
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/responses"), expect.objectContaining({ method: "PATCH" }));
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/submit"), expect.objectContaining({ method: "POST" }));
    });

    it("shows a completed score and exhausted attempt policy", async () => {
        const attempt = { id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: new Date().toISOString(), submittedAt: new Date().toISOString(), isCompleted: true, score: 84.6 };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            id: "test-1", title: "Finished quiz", type: "TEST", passingScore: 70, maxAttempts: 1, questions: [],
            attemptPolicy: { maxAttempts: 1, completedAttempts: 1, remainingAttempts: 0, activeAttemptId: null, nextAttemptNumber: null, canStart: false },
            attemptHistory: [attempt], bestAttempt: attempt,
            resultReview: [
                { questionId: "q1", questionText: "What do bees collect?", learnerAnswer: "Water", pointsAwarded: 0, maxPoints: 2, expectedAnswer: "Pollen" },
                { questionId: "q2", questionText: "How many wings?", learnerAnswer: "Four", pointsAwarded: 1, maxPoints: 1, expectedAnswer: null },
            ],
        }), { status: 200 })));
        render(<TestView classroomId="class-1" testId="test-1" isTeacher={false} />);
        expect(await screen.findByText("85%")).toBeInTheDocument();
        expect(screen.getByText("No attempts remaining.")).toBeInTheDocument();
        expect(screen.getByText("Expected answer: Pollen")).toBeInTheDocument();
        expect(screen.queryByText(/Expected answer: Four/i)).not.toBeInTheDocument();
    });
});

describe("TestView teacher grading", () => {
    it("renders status tabs and validates written grades before saving", async () => {
        const attempt = {
            id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: new Date().toISOString(), submittedAt: new Date().toISOString(),
            isCompleted: true, score: null, gradingStatus: "NEEDS_REVIEW", manualResponsesRemaining: 1,
            user: { id: "student-1", name: "Ada" },
            responses: [{
                id: "response-1", questionId: "question-1", responseText: "Because flowers need pollen", pointsAwarded: null,
                teacherComment: null, isCorrect: null,
                question: { id: "question-1", questionText: "Why do bees matter?", questionType: "ESSAY", points: 5, options: [], answers: [] },
            }],
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            test: { id: "test-1", title: "Teacher quiz", type: "TEST", maxAttempts: 1, questions: [attempt.responses[0].question] },
            dashboard: { completed: [attempt], inProgress: [{ ...attempt, id: "active", isCompleted: false }], notStarted: [{ user: { id: "student-2", name: "Grace" } }] },
        }), { status: 200 })));

        render(<TestView classroomId="class-1" testId="test-1" isTeacher />);
        expect(await screen.findByRole("heading", { name: "Teacher quiz" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Completed\s*1/i })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByText("Because flowers need pollen")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Save grades/i }));
        expect(mocks.error).toHaveBeenCalledWith("Grade every written response before saving.");
        fireEvent.click(screen.getByRole("tab", { name: /Not started\s*1/i }));
        expect(screen.getByRole("heading", { name: "Learners who have not started" })).toBeInTheDocument();
    });
});
