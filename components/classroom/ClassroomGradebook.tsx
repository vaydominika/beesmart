"use client";

import { useState, useEffect, useCallback } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ClipboardCheck } from "lucide-react";

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
        dueDate: string;
        grade?: { score: number; maxScore?: number | null; feedback?: string | null } | null;
    }>;
    tests: Array<{
        id: string;
        title: string;
        type: string;
        attempt?: { score: number; submittedAt: string } | null;
    }>;
    students?: Array<{
        student: { id: string; name: string; email: string; avatar?: string | null };
        assignmentGrades: Array<{ assignmentId: string; score: number | null; maxScore: number | null }>;
        testGrades: Array<{ testId: string; score: number | null }>;
    }>;
}

export function ClassroomGradebook({ classroomId, isTeacher }: Props) {
    const [data, setData] = useState<GradebookData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchGradebook = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/gradebook`);
            if (!res.ok) return;
            setData(await res.json());
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [classroomId]);

    useEffect(() => {
        fetchGradebook();
    }, [fetchGradebook]);

    if (loading) {
        return <div className="flex justify-center py-10"><Spinner /></div>;
    }

    if (!data) {
        return <p className="text-sm text-(--theme-text) opacity-50 text-center py-10">No gradebook data available.</p>;
    }

    // Student View
    if (data.role === "STUDENT") {
        return (
            <div className="space-y-6">
                {/* Assignment Grades */}
                {data.assignments.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-sm font-semibold text-[#20231f]">Assignment grades</h3>
                        <div className="space-y-2">
                            {data.assignments.map((a) => (
                                <FancyCard key={a.id} className="bg-white p-4 border border-[#e6e6e0] shadow-none">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-(--theme-text)">{a.title}</span>
                                        {a.grade ? (
                                            <span className={cn(
                                                "text-sm font-bold px-2 py-0.5 rounded-md",
                                                a.grade.maxScore && a.grade.score / a.grade.maxScore >= 0.7
                                                    ? "bg-green-500/20 text-green-500"
                                                    : "bg-orange-500/20 text-orange-500"
                                            )}>
                                                {a.grade.score}{a.grade.maxScore ? `/${a.grade.maxScore}` : ""}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-(--theme-text) opacity-40">Not graded</span>
                                        )}
                                    </div>
                                    {a.grade?.feedback && (
                                        <p className="text-xs text-(--theme-text) opacity-60 mt-1 italic">&ldquo;{a.grade.feedback}&rdquo;</p>
                                    )}
                                </FancyCard>
                            ))}
                        </div>
                    </div>
                )}

                {/* Test Scores */}
                {data.tests.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-sm font-semibold text-[#20231f]">Test scores</h3>
                        <div className="space-y-2">
                            {data.tests.map((t) => (
                                <FancyCard key={t.id} className="bg-white p-4 border border-[#e6e6e0] shadow-none">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-bold text-(--theme-text)">{t.title}</span>
                                            <span className="text-xs text-(--theme-text) opacity-40 ml-2 uppercase">{t.type}</span>
                                        </div>
                                        {t.attempt ? (
                                            <span className={cn(
                                                "text-sm font-bold px-2 py-0.5 rounded-md",
                                                t.attempt.score >= 70
                                                    ? "bg-green-500/20 text-green-500"
                                                    : "bg-orange-500/20 text-orange-500"
                                            )}>
                                                {Math.round(t.attempt.score)}%
                                            </span>
                                        ) : (
                                            <span className="text-xs text-(--theme-text) opacity-40">Not taken</span>
                                        )}
                                    </div>
                                </FancyCard>
                            ))}
                        </div>
                    </div>
                )}

                {data.assignments.length === 0 && data.tests.length === 0 && (
                    <div className="rounded-xl border border-[#e6e6e0] bg-white px-5 py-12 text-center">
                        <ClipboardCheck className="mx-auto h-6 w-6 text-[#aaada6]" />
                        <p className="mt-3 text-sm font-semibold text-[#20231f]">No grades yet</p>
                        <p className="mt-1 text-xs text-[#858880]">Your assignment and test results will appear here.</p>
                    </div>
                )}
            </div>
        );
    }

    // Teacher View
    return (
        <div>
            {(data.assignments.length === 0 && data.tests.length === 0) ? (
                <div className="rounded-xl border border-[#e6e6e0] bg-white px-5 py-12 text-center">
                    <ClipboardCheck className="mx-auto h-6 w-6 text-[#aaada6]" />
                    <p className="mt-3 text-sm font-semibold text-[#20231f]">No graded work yet</p>
                    <p className="mt-1 text-xs text-[#858880]">Assignments and tests will appear here after you create them.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <FancyCard className="bg-white p-0 border border-[#e6e6e0] shadow-none">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#e2e2dc] bg-[#f7f7f4]">
                                    <th className="sticky left-0 w-[36%] min-w-[180px] bg-[#f7f7f4] p-3 text-left align-top text-xs font-semibold text-[#555952]">
                                        Student
                                    </th>
                                    {data.assignments.map((a) => (
                                        <th key={a.id} className="min-w-[140px] p-3 align-top text-xs font-semibold text-[#555952]">
                                            <div className="mx-auto flex w-fit max-w-[160px] flex-col items-center gap-0.5 text-center">
                                                <span className="max-w-[160px] truncate" title={a.title}>{a.title}</span>
                                                {a.maxPoints && <span className="text-[10px] font-medium opacity-50">/{a.maxPoints}</span>}
                                            </div>
                                        </th>
                                    ))}
                                    {data.tests.map((t) => (
                                        <th key={t.id} className="min-w-[140px] p-3 align-top text-xs font-semibold text-[#555952]">
                                            <div className="mx-auto flex w-fit max-w-[160px] flex-col items-center gap-0.5 text-center">
                                                <span className="max-w-[160px] truncate" title={t.title}>{t.title}</span>
                                                <span className="text-[10px] font-medium uppercase opacity-50">{t.type}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {!data.students?.length && (
                                    <tr>
                                        <td colSpan={1 + data.assignments.length + data.tests.length} className="px-5 py-12 text-center">
                                            <ClipboardCheck className="mx-auto h-6 w-6 text-[#aaada6]" />
                                            <p className="mt-3 text-sm font-semibold text-[#20231f]">No submissions yet</p>
                                            <p className="mt-1 text-xs text-[#858880]">Grades will appear after a student hands in an assignment or completes a test.</p>
                                        </td>
                                    </tr>
                                )}
                                {data.students?.map((s) => (
                                    <tr key={s.student.id} className="border-b border-[#edede8] transition-colors hover:bg-[#fafaf7]">
                                        <td className="sticky left-0 bg-white p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f1ec] text-xs font-semibold text-[#4f534d]">
                                                    {s.student.name?.[0]?.toUpperCase() || "?"}
                                                </div>
                                                <span className="font-bold text-(--theme-text) text-xs whitespace-nowrap">{s.student.name}</span>
                                            </div>
                                        </td>
                                        {s.assignmentGrades.map((g, i) => (
                                            <td key={i} className="text-center p-3">
                                                {g.score !== null ? (
                                                    <span className={cn(
                                                        "text-xs font-bold px-1.5 py-0.5 rounded-md",
                                                        g.maxScore && g.score / g.maxScore >= 0.7
                                                            ? "bg-green-500/20 text-green-500"
                                                            : "bg-orange-500/20 text-orange-500"
                                                    )}>
                                                        {g.score}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-(--theme-text) opacity-30">—</span>
                                                )}
                                            </td>
                                        ))}
                                        {s.testGrades.map((g, i) => (
                                            <td key={i} className="text-center p-3">
                                                {g.score !== null ? (
                                                    <span className={cn(
                                                        "text-xs font-bold px-1.5 py-0.5 rounded-md",
                                                        g.score >= 70
                                                            ? "bg-green-500/20 text-green-500"
                                                            : "bg-orange-500/20 text-orange-500"
                                                    )}>
                                                        {Math.round(g.score)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-(--theme-text) opacity-30">—</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </FancyCard>
                </div>
            )}
        </div>
    );
}
