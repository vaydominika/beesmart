"use client";

import { useState, useEffect, useCallback } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

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
                        <h3 className="text-xs font-bold text-(--theme-text) uppercase mb-3">Assignment Grades</h3>
                        <div className="space-y-2">
                            {data.assignments.map((a) => (
                                <FancyCard key={a.id} className="bg-(--theme-card) p-3">
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
                        <h3 className="text-xs font-bold text-(--theme-text) uppercase mb-3">Test Scores</h3>
                        <div className="space-y-2">
                            {data.tests.map((t) => (
                                <FancyCard key={t.id} className="bg-(--theme-card) p-3">
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
                    <p className="text-sm text-(--theme-text) opacity-50 text-center py-10">No grades yet.</p>
                )}
            </div>
        );
    }

    // Teacher View
    return (
        <div>
            {(data.assignments.length === 0 && data.tests.length === 0) ? (
                <p className="text-sm text-(--theme-text) opacity-50 text-center py-10">No graded items yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <FancyCard className="bg-(--theme-card) p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-(--theme-text)/10">
                                    <th className="text-left p-3 text-xs font-bold text-(--theme-text) uppercase sticky left-0 bg-(--theme-card)">
                                        Student
                                    </th>
                                    {data.assignments.map((a) => (
                                        <th key={a.id} className="text-center p-3 text-xs font-bold text-(--theme-text) uppercase min-w-[80px]">
                                            <div className="truncate max-w-[100px]" title={a.title}>{a.title}</div>
                                            {a.maxPoints && <span className="text-[10px] opacity-50">/{a.maxPoints}</span>}
                                        </th>
                                    ))}
                                    {data.tests.map((t) => (
                                        <th key={t.id} className="text-center p-3 text-xs font-bold text-(--theme-text) uppercase min-w-[80px]">
                                            <div className="truncate max-w-[100px]" title={t.title}>{t.title}</div>
                                            <span className="text-[10px] opacity-50">{t.type}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.students?.map((s) => (
                                    <tr key={s.student.id} className="border-b border-(--theme-text)/5 hover:bg-(--theme-sidebar)/30">
                                        <td className="p-3 sticky left-0 bg-(--theme-card)">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-(--theme-sidebar) flex items-center justify-center text-xs font-bold text-(--theme-text)">
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
