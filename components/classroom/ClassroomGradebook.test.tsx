import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassroomGradebook } from "./ClassroomGradebook";

afterEach(() => vi.unstubAllGlobals());

describe("ClassroomGradebook work links", () => {
    it("links a learner only to their own assignment and test", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            role: "STUDENT",
            assignments: [{
                id: "assignment-1", title: "Essay", maxPoints: 20, deadlineAt: new Date().toISOString(),
                deadlineTimeZone: "Europe/Budapest", deadlineHasTime: true,
                grade: { score: 18, maxScore: 20, feedback: null }, submission: { status: "GRADED", submittedAt: new Date().toISOString() },
            }],
            tests: [{ id: "test-1", title: "Quiz", type: "TEST", attempt: { id: "attempt-1", score: 85, submittedAt: new Date().toISOString() } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } })));

        render(<ClassroomGradebook classroomId="class-1" />);

        expect(await screen.findByRole("link", { name: /Open assignment/i })).toHaveAttribute("href", "/classroom/class-1/assignments/assignment-1");
        expect(screen.queryByRole("button", { name: /Edit assignment/i })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /QuizTestGraded/i }));
        expect(await screen.findByRole("link", { name: /Open test/i })).toHaveAttribute("href", "/classroom/class-1/tests/test-1?attempt=attempt-1");
    });

    it("links a teacher to the complete assignment from the section footer", async () => {
        const eventUpdate = vi.fn();
        window.addEventListener("calendar-events-updated", eventUpdate);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            role: "TEACHER",
            assignments: [{ id: "assignment-1", title: "Essay", maxPoints: 20, deadlineAt: new Date().toISOString(), deadlineTimeZone: "Europe/Budapest", deadlineHasTime: true }],
            tests: [],
            students: [{
                student: { id: "student-1", name: "Ada", email: "ada@example.com" },
                assignmentGrades: [{ assignmentId: "assignment-1", score: 18, maxScore: 20, submissionStatus: "GRADED", submittedAt: new Date().toISOString() }],
                testGrades: [],
            }],
        }), { status: 200, headers: { "Content-Type": "application/json" } })));

        render(<ClassroomGradebook classroomId="class-1" />);

        expect(await screen.findByRole("link", { name: "Open assignment" })).toHaveAttribute("href", "/classroom/class-1/assignments/assignment-1");
        expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Edit assignment Essay" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Delete assignment Essay" }));
        expect(screen.getByRole("heading", { name: "Delete assignment?" })).toBeInTheDocument();
        expect(screen.getByText(/all of its submissions and grades/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(eventUpdate).toHaveBeenCalledOnce());
        window.removeEventListener("calendar-events-updated", eventUpdate);
    });
});
