import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestView } from "./TestView";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

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
});
