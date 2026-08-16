"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatDateYmd } from "@/lib/date";
import { ChevronDown, ClipboardList, GraduationCap } from "lucide-react";

interface Props {
    classroomId: string;
    isTeacher: boolean;
}

interface GradebookData {
    role: string;
    assignments: Array<{
        id: string;
        title: string;
        maxPoints?: number | null;
        deadlineAt: string;
        deadlineTimeZone: string;
        deadlineHasTime: boolean;
        grade?: { score: number; maxScore?: number | null; feedback?: string | null } | null;
        submission?: { status: string; submittedAt?: string | null } | null;
    }>;
    tests: Array<{
        id: string;
        title: string;
        type: "TEST" | "EXAM";
        attempt?: { score: number; submittedAt: string } | null;
    }>;
    students?: Array<{
        student: { id: string; name: string; email: string; avatar?: string | null };
        assignmentGrades: Array<{
            assignmentId: string;
            score: number | null;
            maxScore: number | null;
            submissionStatus: string | null;
            submittedAt: string | null;
        }>;
        testGrades: Array<{ testId: string; score: number | null; submittedAt: string | null }>;
    }>;
}

interface GradeSectionProps {
    title: string;
    type: "Assignment" | "Test" | "Exam";
    detail: string;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
}

function GradeSection({ title, type, detail, isOpen, onToggle, children }: GradeSectionProps) {
    const WorkIcon = type === "Assignment" ? ClipboardList : GraduationCap;

    return (
        <section className="overflow-hidden rounded-xl border border-(--classroom-line) bg-(--classroom-surface)">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--classroom-surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--classroom-focus-ring)"
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--classroom-accent)">
                    <WorkIcon className="h-4 w-4 text-(--classroom-text-muted)" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-(--classroom-text)">{title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-(--classroom-text-muted)">
                        <span>{type}</span>
                        <span>{detail}</span>
                    </span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-(--classroom-text-muted) transition-transform duration-200 motion-reduce:transition-none", isOpen && "rotate-180")} />
            </button>
            {isOpen && <div className="border-t border-(--classroom-line)">{children}</div>}
        </section>
    );
}

const statusLabel = (status?: string | null) => {
    if (!status) return "Not submitted";
    return status.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
};

export function ClassroomGradebook({ classroomId }: Props) {
    const [data, setData] = useState<GradebookData | null>(null);
    const [loading, setLoading] = useState(true);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set());

    const fetchGradebook = useCallback(async () => {
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/gradebook`);
            if (!response.ok) return;
            const result: GradebookData = await response.json();
            setData(result);
            setOpenSections((current) => {
                if (current.size > 0) return current;
                const firstId = result.assignments[0]?.id
                    ? `assignment:${result.assignments[0].id}`
                    : result.tests[0]?.id
                        ? `test:${result.tests[0].id}`
                        : null;
                return firstId ? new Set([firstId]) : current;
            });
        } catch {
            // Keep the gradebook empty if loading fails.
        } finally {
            setLoading(false);
        }
    }, [classroomId]);

    useEffect(() => {
        fetchGradebook();
    }, [fetchGradebook]);

    const toggleSection = (sectionId: string) => {
        setOpenSections((current) => {
            const next = new Set(current);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
        });
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

    if (!data) {
        return <p className="py-10 text-center text-sm text-(--classroom-text-muted)">No gradebook data available.</p>;
    }

    if (data.assignments.length === 0 && data.tests.length === 0) {
        return (
            <div className="rounded-xl border border-(--classroom-line) bg-(--classroom-surface) px-5 py-12 text-center">
                <p className="text-sm font-semibold text-(--classroom-text)">No graded work yet</p>
                <p className="mt-1 text-xs text-(--classroom-text-muted)">
                    {data.role === "STUDENT" ? "Your assignments, tests, and exams will appear here." : "Assignments, tests, and exams will appear here after you create them."}
                </p>
            </div>
        );
    }

    if (data.role === "STUDENT") {
        return (
            <div className="space-y-3">
                {data.assignments.map((assignment) => {
                    const sectionId = `assignment:${assignment.id}`;
                    return (
                        <GradeSection
                            key={sectionId}
                            title={assignment.title}
                            type="Assignment"
                            detail={assignment.maxPoints ? `${assignment.maxPoints} points` : "Graded"}
                            isOpen={openSections.has(sectionId)}
                            onToggle={() => toggleSection(sectionId)}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[420px] text-sm">
                                    <thead className="bg-(--classroom-surface-muted) text-xs font-medium text-(--classroom-text-muted)">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left">Status</th>
                                            <th className="px-4 py-2.5 text-left">Submitted</th>
                                            <th className="px-4 py-2.5 text-right">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="px-4 py-3 text-(--classroom-text)">{assignment.grade ? "Graded" : statusLabel(assignment.submission?.status)}</td>
                                            <td className="px-4 py-3 text-(--classroom-text-muted)">{assignment.submission?.submittedAt ? formatDateYmd(assignment.submission.submittedAt) : "—"}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-(--classroom-text)">
                                                {assignment.grade ? `${assignment.grade.score}${assignment.grade.maxScore ? `/${assignment.grade.maxScore}` : ""}` : "—"}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                {assignment.grade?.feedback && <p className="border-t border-(--classroom-line) px-4 py-3 text-xs text-(--classroom-text-muted)">{assignment.grade.feedback}</p>}
                            </div>
                        </GradeSection>
                    );
                })}

                {data.tests.map((test) => {
                    const sectionId = `test:${test.id}`;
                    return (
                        <GradeSection
                            key={sectionId}
                            title={test.title}
                            type={test.type === "EXAM" ? "Exam" : "Test"}
                            detail={test.attempt ? "Completed" : "Not completed"}
                            isOpen={openSections.has(sectionId)}
                            onToggle={() => toggleSection(sectionId)}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[360px] text-sm">
                                    <thead className="bg-(--classroom-surface-muted) text-xs font-medium text-(--classroom-text-muted)">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left">Status</th>
                                            <th className="px-4 py-2.5 text-left">Completed</th>
                                            <th className="px-4 py-2.5 text-right">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="px-4 py-3 text-(--classroom-text)">{test.attempt ? "Completed" : "Not completed"}</td>
                                            <td className="px-4 py-3 text-(--classroom-text-muted)">{test.attempt?.submittedAt ? formatDateYmd(test.attempt.submittedAt) : "—"}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-(--classroom-text)">{test.attempt ? `${Math.round(test.attempt.score)}%` : "—"}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </GradeSection>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {data.assignments.map((assignment) => {
                const sectionId = `assignment:${assignment.id}`;
                const rows = (data.students ?? []).flatMap((student) => {
                    const result = student.assignmentGrades.find((grade) => grade.assignmentId === assignment.id);
                    return result && (result.submissionStatus || result.score !== null) ? [{ student: student.student, result }] : [];
                });

                return (
                    <GradeSection
                        key={sectionId}
                        title={assignment.title}
                        type="Assignment"
                        detail={`${rows.length} submission${rows.length === 1 ? "" : "s"}`}
                        isOpen={openSections.has(sectionId)}
                        onToggle={() => toggleSection(sectionId)}
                    >
                        {rows.length === 0 ? (
                            <div className="px-5 py-9 text-center">
                                <p className="text-sm font-medium text-(--classroom-text)">No one has handed in this assignment yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] text-sm">
                                    <thead className="bg-(--classroom-surface-muted) text-xs font-medium text-(--classroom-text-muted)">
                                        <tr>
                                            <th className="w-[38%] px-4 py-2.5 text-left">Student</th>
                                            <th className="px-4 py-2.5 text-left">Submitted</th>
                                            <th className="px-4 py-2.5 text-left">Status</th>
                                            <th className="px-4 py-2.5 text-right">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--classroom-line)">
                                        {rows.map(({ student, result }) => (
                                            <tr key={student.id} className="hover:bg-(--classroom-surface-hover)">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--classroom-surface-muted) text-xs font-semibold text-(--classroom-text-muted)">{student.name?.[0]?.toUpperCase() || "?"}</span>
                                                        <span className="font-medium text-(--classroom-text)">{student.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-(--classroom-text-muted)">{result.submittedAt ? formatDateYmd(result.submittedAt) : "—"}</td>
                                                <td className="px-4 py-3 text-(--classroom-text-muted)">{result.score !== null ? "Graded" : statusLabel(result.submissionStatus)}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-(--classroom-text)">{result.score !== null ? `${result.score}${result.maxScore ? `/${result.maxScore}` : ""}` : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GradeSection>
                );
            })}

            {data.tests.map((test) => {
                const sectionId = `test:${test.id}`;
                const rows = (data.students ?? []).flatMap((student) => {
                    const result = student.testGrades.find((grade) => grade.testId === test.id);
                    return result && (result.submittedAt || result.score !== null) ? [{ student: student.student, result }] : [];
                });

                return (
                    <GradeSection
                        key={sectionId}
                        title={test.title}
                        type={test.type === "EXAM" ? "Exam" : "Test"}
                        detail={`${rows.length} completed`}
                        isOpen={openSections.has(sectionId)}
                        onToggle={() => toggleSection(sectionId)}
                    >
                        {rows.length === 0 ? (
                            <div className="px-5 py-9 text-center">
                                <p className="text-sm font-medium text-(--classroom-text)">No one has completed this {test.type === "EXAM" ? "exam" : "test"} yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[500px] text-sm">
                                    <thead className="bg-(--classroom-surface-muted) text-xs font-medium text-(--classroom-text-muted)">
                                        <tr>
                                            <th className="w-[50%] px-4 py-2.5 text-left">Student</th>
                                            <th className="px-4 py-2.5 text-left">Completed</th>
                                            <th className="px-4 py-2.5 text-right">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--classroom-line)">
                                        {rows.map(({ student, result }) => (
                                            <tr key={student.id} className="hover:bg-(--classroom-surface-hover)">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--classroom-surface-muted) text-xs font-semibold text-(--classroom-text-muted)">{student.name?.[0]?.toUpperCase() || "?"}</span>
                                                        <span className="font-medium text-(--classroom-text)">{student.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-(--classroom-text-muted)">{result.submittedAt ? formatDateYmd(result.submittedAt) : "—"}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-(--classroom-text)">{result.score !== null ? `${Math.round(result.score)}%` : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GradeSection>
                );
            })}
        </div>
    );
}
