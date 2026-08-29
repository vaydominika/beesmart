"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceProgress } from "@/components/ui/workspace-progress";
import { WorkspaceLoadingState } from "@/components/ui/workspace-state";
import { AiUsageStatus, useAiUsage } from "@/components/ai/ai-usage";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
    AI_GRADING_BATCH_CONCURRENCY,
    AI_GRADING_BATCH_SIZE,
    TEST_TOTAL_WRITTEN_CHARACTER_LIMIT,
    totalWrittenCharacters,
    writtenResponseLimit,
} from "@/lib/test-response-limits";
import {
    Clock, CheckCircle2, FileText,
    AlertCircle, Play, ArrowRight, Save, UserRound, RefreshCw, Sparkles
} from "lucide-react";

interface Props {
    classroomId: string;
    testId: string;
    isTeacher: boolean;
}

interface TestQuestion {
    id: string;
    questionText: string;
    questionType: string;
    points: number;
    options: Array<{ id: string; optionText: string; isCorrect?: boolean }>;
    answers?: Array<{ answerText: string | null; isCorrect: boolean | null }>;
}

interface TestDetails {
    id: string;
    title: string;
    description?: string | null;
    type: string;
    timeLimit?: number | null;
    passingScore?: number | null;
    opensAt?: string | null;
    closesAt?: string | null;
    maxAttempts: number;
    questions: TestQuestion[];
}

interface TestAttempt {
    id: string;
    userId: string;
    attemptNumber: number;
    startedAt: string;
    submittedAt?: string | null;
    isCompleted: boolean;
    score?: number | null;
}

interface TeacherTestAttempt extends TestAttempt {
    user: { id: string; name: string; avatar?: string; email?: string };
    responses: Array<{
        id: string;
        questionId: string;
        responseText?: string | null;
        selectedOptionId?: string | null;
        isCorrect?: boolean | null;
        pointsAwarded?: number | null;
        teacherComment?: string | null;
        aiSuggestedPoints?: number | null;
        aiSuggestedFeedback?: string | null;
        aiSuggestedConfidence?: "HIGH" | "MEDIUM" | "LOW" | null;
        question: TestQuestion & { answers: Array<{ answerText: string, isCorrect: boolean }> };
    }>;
    gradingStatus: "NEEDS_REVIEW" | "GRADED" | "IN_PROGRESS";
    manualResponsesRemaining: number;
}

interface AttemptPolicy {
    maxAttempts: number;
    completedAttempts: number;
    remainingAttempts: number;
    activeAttemptId: string | null;
    nextAttemptNumber: number | null;
    canStart: boolean;
}

interface TeacherDashboardView {
    completed: TeacherTestAttempt[];
    inProgress: TeacherTestAttempt[];
    notStarted: Array<{ user: { id: string; name: string } }>;
}

type NotStartedLearner = { user: { id: string; name: string } };
type GradeSuggestion = {
    responseId: string;
    suggestedScore: number;
    feedback: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
};

export function TestView({ classroomId, testId, isTeacher }: Props) {
    const searchParams = useSearchParams();
    const requestedAttemptId = searchParams.get("attempt");
    const [loading, setLoading] = useState(true);
    const [test, setTest] = useState<TestDetails | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    // --- STUDENT STATE ---
    const [attempt, setAttempt] = useState<TestAttempt | null>(null);
    const [testState, setTestState] = useState<"PRE_TEST" | "IN_PROGRESS" | "COMPLETED">("PRE_TEST");
    const [responses, setResponses] = useState<Record<string, { selectedOptionId?: string, responseText?: string }>>({});
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [attemptPolicy, setAttemptPolicy] = useState<AttemptPolicy | null>(null);
    const [attemptHistory, setAttemptHistory] = useState<TestAttempt[]>([]);
    const [bestAttempt, setBestAttempt] = useState<TestAttempt | null>(null);
    const [saveState, setSaveState] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");
    const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // --- TEACHER STATE ---
    const [dashboardData, setDashboardData] = useState<TeacherDashboardView | null>(null);
    const [teacherTab, setTeacherTab] = useState<"completed" | "inProgress" | "notStarted">("completed");
    const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
    const [grading, setGrading] = useState(false);
    // Draft grades format: { responseId: { pointsAwarded: number, isCorrect: boolean, comment: string } }
    const [draftGrades, setDraftGrades] = useState<Record<string, { pointsAwarded?: string, teacherComment?: string }>>({});
    const [gradeSuggestions, setGradeSuggestions] = useState<Record<string, GradeSuggestion>>({});
    const [suggestingGrades, setSuggestingGrades] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number; failed: number } | null>(null);
    const { usage: gradingUsage, exhausted: gradingExhausted, syncFromResponse: syncGradingUsage } = useAiUsage("GRADING", isTeacher);
    const submitTestRef = useRef<() => void>(() => undefined);


    // 1. Fetch Initial Data based on Role
    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            if (isTeacher) {
                const testRes = await fetch(`/api/classrooms/${classroomId}/tests/${testId}/dashboard`);
                const data = await testRes.json().catch(() => ({}));
                if (!testRes.ok) throw new Error(data.error || "Teacher dashboard could not be loaded");
                setTest(data.test);
                setDashboardData(data.dashboard);
                const requestedAttempt = data.dashboard.completed.find((attempt: TeacherTestAttempt) => attempt.id === requestedAttemptId);
                setSelectedAttemptId((current) => requestedAttempt?.id ?? current ?? data.dashboard.completed[0]?.id ?? null);

            } else {
                const res = await fetch(`/api/classrooms/${classroomId}/tests/${testId}`);
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "Could not load test.");
                }
                const data = await res.json();
                setTest(data);
                setAttemptPolicy(data.attemptPolicy);
                setAttemptHistory(data.attemptHistory ?? []);
                setBestAttempt(data.bestAttempt ?? null);
                setAttempt(null);
                setResponses({});
                setSaveState("IDLE");
                setTestState((data.attemptHistory?.some((item: TestAttempt) => item.isCompleted) && !data.attemptPolicy.activeAttemptId) ? "COMPLETED" : "PRE_TEST");
            }
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : "Error loading test details.";
            setLoadError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, [classroomId, testId, isTeacher, requestedAttemptId]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => () => {
        Object.values(saveTimers.current).forEach(clearTimeout);
    }, []);

    // Timer logic
    useEffect(() => {
        if (testState === "IN_PROGRESS" && timeLeft !== null && timeLeft > 0) {
            const timerId = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(timerId);
                        toast.warning("Time is up! Submitting answers...");
                        submitTestRef.current();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [testState, timeLeft]);

    // --- STUDENT ACTIONS ---
    const handleStartTest = async () => {
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/tests/${testId}/start`, { method: "POST" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "The attempt could not be started");
            setTest(data.test);
            setAttempt(data.attempt);
            setResponses(Object.fromEntries((data.responses ?? []).map((saved: { questionId: string; selectedOptionId?: string | null; responseText?: string | null }) => [
                saved.questionId,
                { selectedOptionId: saved.selectedOptionId ?? undefined, responseText: saved.responseText ?? undefined },
            ])));
            setTestState("IN_PROGRESS");
            if (data.test.timeLimit) {
                const elapsedSeconds = (Date.now() - new Date(data.attempt.startedAt).getTime()) / 1000;
                setTimeLeft(Math.max(0, data.test.timeLimit * 60 - elapsedSeconds));
            } else {
                setTimeLeft(null);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "The attempt could not be started.");
        }
    };

    const saveDraftResponse = useCallback(async (questionId: string, responseValue: { selectedOptionId?: string; responseText?: string }) => {
        if (!attempt) return;
        setSaveState("SAVING");
        const response = await fetch(`/api/classrooms/${classroomId}/tests/${testId}/attempts/${attempt.id}/responses`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, ...responseValue }),
        });
        if (!response.ok) {
            setSaveState("ERROR");
            throw new Error("Draft response could not be saved");
        }
        setSaveState("SAVED");
    }, [attempt, classroomId, testId]);

    const handleAnswerChange = (questionId: string, value: string, type: string) => {
        const nextValue = type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE"
            ? { selectedOptionId: value }
            : { responseText: value };
        const nextResponses = { ...responses, [questionId]: nextValue };
        if (totalWrittenCharacters(Object.values(nextResponses)) > TEST_TOTAL_WRITTEN_CHARACTER_LIMIT) {
            toast.error(`Written answers can total up to ${TEST_TOTAL_WRITTEN_CHARACTER_LIMIT.toLocaleString()} characters per attempt.`);
            return;
        }
        setResponses(nextResponses);
        setSaveState("SAVING");
        clearTimeout(saveTimers.current[questionId]);
        saveTimers.current[questionId] = setTimeout(() => {
            void saveDraftResponse(questionId, nextValue).catch(() => undefined);
        }, 500);
    };

    const handleSubmitTest = async () => {
        setSubmitting(true);
        try {
            Object.values(saveTimers.current).forEach(clearTimeout);
            const formattedResponses = Object.entries(responses).map(([qId, r]) => ({
                questionId: qId,
                selectedOptionId: r.selectedOptionId,
                responseText: r.responseText
            }));
            await Promise.all(Object.entries(responses).map(([questionId, response]) => saveDraftResponse(questionId, response)));

            const res = await fetch(`/api/classrooms/${classroomId}/tests/${testId}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    attemptId: attempt?.id,
                    responses: formattedResponses
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Test submission failed");

            setAttempt(data.attempt);
            setTestState("COMPLETED");
            setBestAttempt(data.attempt.score == null || (bestAttempt?.score ?? -1) > data.attempt.score ? bestAttempt : data.attempt);
            setAttemptHistory((current) => [...current.filter((item) => item.id !== data.attempt.id), data.attempt]);
            setAttemptPolicy((current) => current ? {
                ...current,
                completedAttempts: current.completedAttempts + 1,
                remainingAttempts: Math.max(0, current.remainingAttempts - 1),
                activeAttemptId: null,
                nextAttemptNumber: current.remainingAttempts > 1 ? data.attempt.attemptNumber + 1 : null,
                canStart: current.remainingAttempts > 1,
            } : current);
            toast.success("Test submitted successfully!");

        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to submit test.");
        } finally {
            setSubmitting(false);
        }
    };
    submitTestRef.current = () => { void handleSubmitTest(); };

    const selectedAttempt = useMemo(
        () => dashboardData?.completed.find((item) => item.id === selectedAttemptId) ?? null,
        [dashboardData, selectedAttemptId],
    );
    const selectedAttemptNeedsDrafts = selectedAttempt?.responses.some((response) =>
        response.question.questionType === "ESSAY"
        && response.pointsAwarded == null
        && Boolean(response.responseText?.trim())
        && response.aiSuggestedPoints == null,
    ) ?? false;
    const attemptsNeedingDrafts = useMemo(() => (dashboardData?.completed ?? []).filter((completedAttempt) =>
        completedAttempt.responses.some((response) =>
            response.question.questionType === "ESSAY"
            && response.pointsAwarded == null
            && Boolean(response.responseText?.trim())
            && response.aiSuggestedPoints == null,
        ),
    ), [dashboardData]);

    useEffect(() => {
        if (!selectedAttempt) {
            setDraftGrades({});
            setGradeSuggestions({});
            return;
        }
        const next: Record<string, { pointsAwarded?: string; teacherComment?: string }> = {};
        const nextSuggestions: Record<string, GradeSuggestion> = {};
        for (const response of selectedAttempt.responses) {
            if (response.question.questionType === "SHORT_ANSWER" || response.question.questionType === "ESSAY") {
                next[response.id] = {
                    pointsAwarded: response.pointsAwarded == null ? "" : String(response.pointsAwarded),
                    teacherComment: response.teacherComment ?? "",
                };
            }
            if (response.question.questionType === "ESSAY" && response.aiSuggestedPoints != null && response.aiSuggestedFeedback) {
                nextSuggestions[response.id] = {
                    responseId: response.id,
                    suggestedScore: response.aiSuggestedPoints,
                    feedback: response.aiSuggestedFeedback,
                    confidence: response.aiSuggestedConfidence ?? "LOW",
                };
            }
        }
        setDraftGrades(next);
        setGradeSuggestions(nextSuggestions);
    }, [selectedAttempt]);

    const storeSuggestions = useCallback((attemptId: string, suggestions: GradeSuggestion[]) => {
        const byResponseId = new Map(suggestions.map((suggestion) => [suggestion.responseId, suggestion]));
        setDashboardData((current) => current ? {
            ...current,
            completed: current.completed.map((completedAttempt) => completedAttempt.id !== attemptId ? completedAttempt : {
                ...completedAttempt,
                responses: completedAttempt.responses.map((response) => {
                    const suggestion = byResponseId.get(response.id);
                    return suggestion ? {
                        ...response,
                        aiSuggestedPoints: suggestion.suggestedScore,
                        aiSuggestedFeedback: suggestion.feedback,
                        aiSuggestedConfidence: suggestion.confidence,
                    } : response;
                }),
            }),
        } : current);
    }, []);

    const requestGradeDrafts = useCallback(async (attemptId: string) => {
        const response = await fetch(`/api/classrooms/${classroomId}/tests/${testId}/ai-grade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
        });
        syncGradingUsage(response);
        const data = await response.json().catch(() => ({})) as { error?: string; suggestions?: GradeSuggestion[] };
        if (!response.ok) throw new Error(data.error || "Grading drafts could not be generated");
        const suggestions = data.suggestions ?? [];
        storeSuggestions(attemptId, suggestions);
        return suggestions;
    }, [classroomId, storeSuggestions, syncGradingUsage, testId]);

    const handleSuggestGrades = async () => {
        if (!selectedAttempt) return;
        setSuggestingGrades(true);
        try {
            const suggestions = await requestGradeDrafts(selectedAttempt.id);
            setGradeSuggestions(Object.fromEntries(suggestions.map((suggestion) => [suggestion.responseId, suggestion])));
            toast.success(suggestions.length ? "Grading drafts are ready for review." : "No ungraded essays found.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Grading drafts could not be generated.");
        } finally {
            setSuggestingGrades(false);
        }
    };

    const handleSuggestAllGrades = async () => {
        const queue = attemptsNeedingDrafts.slice(0, AI_GRADING_BATCH_SIZE);
        if (queue.length === 0) return;
        setSuggestingGrades(true);
        setBatchProgress({ completed: 0, total: queue.length, failed: 0 });
        let nextIndex = 0;
        let completed = 0;
        let failed = 0;
        const worker = async () => {
            while (nextIndex < queue.length) {
                const item = queue[nextIndex++];
                try {
                    await requestGradeDrafts(item.id);
                } catch {
                    failed += 1;
                } finally {
                    completed += 1;
                    setBatchProgress({ completed, total: queue.length, failed });
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(AI_GRADING_BATCH_CONCURRENCY, queue.length) }, () => worker()));
        setSuggestingGrades(false);
        if (failed) {
            toast.warning(`${queue.length - failed} grading drafts completed; ${failed} need another try.`);
        } else {
            toast.success(`${queue.length} grading ${queue.length === 1 ? "draft" : "drafts"} ready for review.`);
        }
    };

    const applySuggestion = (responseId: string) => {
        const suggestion = gradeSuggestions[responseId];
        if (!suggestion) return;
        setDraftGrades((current) => ({
            ...current,
            [responseId]: { pointsAwarded: String(suggestion.suggestedScore), teacherComment: suggestion.feedback },
        }));
    };

    const applyAllSuggestions = () => {
        setDraftGrades((current) => {
            const next = { ...current };
            for (const [responseId, suggestion] of Object.entries(gradeSuggestions)) {
                next[responseId] = { pointsAwarded: String(suggestion.suggestedScore), teacherComment: suggestion.feedback };
            }
            return next;
        });
    };

    const handleSaveGrades = async () => {
        if (!selectedAttempt) return;
        const manualResponses = selectedAttempt.responses.filter((response) =>
            response.question.questionType === "SHORT_ANSWER" || response.question.questionType === "ESSAY"
        );
        const grades = manualResponses.map((response) => ({
            responseId: response.id,
            pointsAwarded: draftGrades[response.id]?.pointsAwarded ?? "",
            teacherComment: draftGrades[response.id]?.teacherComment ?? "",
        }));
        if (grades.some((grade) => grade.pointsAwarded === "")) {
            toast.error("Grade every written response before saving.");
            return;
        }
        setGrading(true);
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/tests/${testId}/grade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attemptId: selectedAttempt.id, grades }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Grades could not be saved");
            toast.success("Grades saved.");
            await fetchInitialData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Grades could not be saved.");
        } finally {
            setGrading(false);
        }
    };

    // --- RENDER HELPERS ---
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (loading) {
        return <WorkspaceLoadingState className="py-20" label="Loading assessment" />;
    }

    if (!test || loadError) return <div className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-8 text-center shadow-none"><AlertCircle className="mx-auto h-8 w-8 text-[var(--app-danger)]" /><h1 className="mt-3 text-lg font-semibold">Assessment unavailable</h1><p className="mt-1 text-sm text-[var(--classroom-text-muted)]">{loadError || "Assessment details could not be loaded."}</p><WorkspaceButton type="button" variant="secondary" onClick={() => void fetchInitialData()} className="mt-5">Try again</WorkspaceButton></div>;

    // =========================================================================
    // STUDENT VIEW
    // =========================================================================
    if (!isTeacher) {
        return (
            <div className="space-y-6">
                {/* Fixed Header */}
                <div className="sticky top-4 z-10 overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-6 shadow-none">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-(--theme-text) mb-1">{test.title}</h1>
                            <div className="flex items-center gap-3 text-xs font-bold text-(--theme-text) opacity-60">
                                <span className="uppercase">{test.type}</span>
                                {test.timeLimit && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {test.timeLimit} mins</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {testState === "IN_PROGRESS" && timeLeft !== null && (
                            <div className={cn(
                                "text-2xl font-black font-mono px-4 py-2 rounded-xl corner-squircle",
                                timeLeft < 60 ? "bg-[var(--app-danger-soft)]0/20 text-[var(--app-danger)] animate-pulse" : "bg-(--theme-sidebar) text-(--theme-text)"
                            )}>
                                {formatTime(timeLeft)}
                            </div>
                        )}

                        {testState === "COMPLETED" && bestAttempt && bestAttempt.score !== null && (
                            <div className="text-right">
                                <span className="text-xs uppercase font-bold opacity-50 block mb-1">Final Score</span>
                                <div className={cn(
                                    "text-3xl font-black",
                                    (bestAttempt.score ?? 0) >= (test.passingScore ?? 50) ? "text-[var(--app-success)]" : "text-[var(--app-warning)]"
                                )}>
                                    {Math.round(bestAttempt.score ?? 0)}%
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* State: PRE_TEST */}
                {testState === "PRE_TEST" && (
                    <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-8 text-center shadow-none">
                        <FileText className="h-16 w-16 mx-auto mb-6 text-(--theme-text) opacity-20" />
                        <h2 className="text-2xl font-bold text-(--theme-text) mb-4">Ready to begin?</h2>
                        {test.description && (
                            <p className="text-sm text-(--theme-text) opacity-80 mb-6">{test.description}</p>
                        )}
                        <div className="bg-(--theme-sidebar) p-4 rounded-xl corner-squircle text-left mb-8 space-y-3">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-[var(--app-warning)]" />
                                <span className="text-sm font-bold text-(--theme-text)">Once you start, the timer cannot be paused.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-[var(--app-info)]" />
                                <span className="text-sm font-bold text-(--theme-text)">Make sure you have a stable connection.</span>
                            </div>
                        </div>
                        <WorkspaceButton type="button" variant="primary" onClick={handleStartTest} disabled={!attemptPolicy?.canStart}>
                            <Play className="h-5 w-5 mr-2" />
                            {attemptPolicy?.activeAttemptId ? `Resume attempt ${attemptPolicy.nextAttemptNumber} of ${attemptPolicy.maxAttempts}` : `Start attempt ${attemptPolicy?.nextAttemptNumber ?? 1} of ${attemptPolicy?.maxAttempts ?? test.maxAttempts}`}
                        </WorkspaceButton>
                        {!attemptPolicy?.canStart && attemptPolicy?.remainingAttempts !== 0 && <p className="mt-3 text-xs font-medium text-[var(--classroom-text-muted)]">This assessment is not currently open.</p>}
                    </div>
                )}

                {/* State: IN_PROGRESS */}
                {testState === "IN_PROGRESS" && (
                    <div className="space-y-8 pb-32 max-w-3xl mx-auto">
                        {test.questions.map((q, index) => (
                            <div key={q.id} className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-(--theme-card) p-6 md:p-8">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-8 h-8 rounded-full bg-(--theme-text) text-(--theme-card) flex items-center justify-center font-black shrink-0">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-(--theme-text) leading-tight mb-2">{q.questionText}</h3>
                                        <span className="text-xs font-bold uppercase text-(--theme-text) opacity-40">{q.points} {q.points === 1 ? 'Point' : 'Points'}</span>
                                    </div>
                                </div>

                                <div className="ml-12">
                                    {(q.questionType === "MULTIPLE_CHOICE" || q.questionType === "TRUE_FALSE") && (
                                        <div className="space-y-3">
                                            {q.options.map((opt) => (
                                                <label
                                                    key={opt.id}
                                                    className={cn(
                                                        "flex items-center gap-3 p-4 rounded-xl corner-squircle cursor-pointer transition-all border-2",
                                                        responses[q.id]?.selectedOptionId === opt.id
                                                            ? "bg-(--theme-text)/5 border-(--theme-text)"
                                                            : "bg-(--theme-sidebar) border-transparent hover:border-(--theme-text)/20"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                                        responses[q.id]?.selectedOptionId === opt.id
                                                            ? "border-(--theme-text)"
                                                            : "border-(--theme-text)/30"
                                                    )}>
                                                        {responses[q.id]?.selectedOptionId === opt.id && (
                                                            <div className="w-2.5 h-2.5 rounded-full bg-(--theme-text)"></div>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-bold text-(--theme-text)">{opt.optionText}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {(q.questionType === "SHORT_ANSWER" || q.questionType === "ESSAY") && (
                                        <div>
                                            <textarea
                                                value={responses[q.id]?.responseText || ""}
                                                onChange={(e) => handleAnswerChange(q.id, e.target.value, q.questionType)}
                                                maxLength={writtenResponseLimit(q.questionType) ?? undefined}
                                                aria-describedby={`response-limit-${q.id}`}
                                                placeholder="Write your answer here..."
                                                className="w-full bg-(--theme-sidebar) rounded-xl corner-squircle text-sm p-4 min-h-[150px] outline-none border-2 border-transparent focus:border-(--theme-text)/20 resize-y font-bold text-(--theme-text)"
                                            />
                                            <p id={`response-limit-${q.id}`} className="mt-1.5 text-right text-[11px] font-medium text-[var(--classroom-text-muted)]">
                                                {(responses[q.id]?.responseText?.length ?? 0).toLocaleString()} / {(writtenResponseLimit(q.questionType) ?? 0).toLocaleString()} characters
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Sticky Submit Bar */}
                        <div className="fixed bottom-0 left-0 w-full bg-(--theme-card) border-t border-(--theme-text)/10 p-4 shadow-2xl z-20">
                            <div className="max-w-3xl mx-auto flex items-center justify-between">
                                <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-bold text-(--theme-text) opacity-60">{Object.keys(responses).length} of {test.questions.length} answered</span><span className="text-xs font-medium text-[var(--classroom-text-muted)]">{totalWrittenCharacters(Object.values(responses)).toLocaleString()} / {TEST_TOTAL_WRITTEN_CHARACTER_LIMIT.toLocaleString()} written characters</span><span className={cn("text-xs font-medium", saveState === "ERROR" ? "text-[var(--app-danger)]" : "text-[var(--classroom-text-muted)]")}>{saveState === "SAVING" ? "Saving..." : saveState === "SAVED" ? "Saved" : saveState === "ERROR" ? "Draft save failed" : ""}</span>{saveState === "ERROR" && <button type="button" onClick={() => void Promise.all(Object.entries(responses).map(([questionId, response]) => saveDraftResponse(questionId, response))).catch(() => undefined)} className="rounded-lg border border-[var(--app-danger-border)] px-2 py-1 text-xs font-semibold text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)]">Retry save</button>}</div>
                                <WorkspaceButton
                                    type="button"
                                    variant="primary"
                                    onClick={handleSubmitTest}
                                    disabled={submitting}
                                >
                                    {submitting ? "Submitting..." : "Submit Exam"}
                                    {!submitting && <ArrowRight className="h-4 w-4 ml-2" />}
                                </WorkspaceButton>
                            </div>
                        </div>
                    </div>
                )}

                {/* State: COMPLETED */}
                {testState === "COMPLETED" && (
                    <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-8 text-center shadow-none">
                        <CheckCircle2 className="h-16 w-16 mx-auto mb-6 text-[var(--app-success)]" />
                        <h2 className="text-2xl font-bold text-(--theme-text) mb-2">Test Submitted</h2>

                        {(attempt?.score ?? bestAttempt?.score) != null ? (
                            <p className="text-sm text-(--theme-text) opacity-80 mb-6">Your test was auto-graded. Check the header for your final score.</p>
                        ) : (
                            <p className="text-sm text-(--theme-text) opacity-80 mb-6">Your test has been submitted and is pending review for essay responses.</p>
                        )}
                        {attemptPolicy?.canStart && attemptPolicy.remainingAttempts > 0 && (
                            <WorkspaceButton type="button" variant="primary" onClick={() => void handleStartTest()}>
                                <Play className="h-4 w-4" />Start attempt {(attempt?.attemptNumber ?? attemptHistory.length) + 1} of {attemptPolicy.maxAttempts}
                            </WorkspaceButton>
                        )}
                        {!attemptPolicy?.canStart && attemptPolicy?.remainingAttempts === 0 && <p className="text-xs font-semibold text-[var(--classroom-text-muted)]">No attempts remaining.</p>}
                    </div>
                )}
            </div>
        );
    }

    // =========================================================================
    // TEACHER VIEW
    // =========================================================================

    const tabItems = [
        { key: "completed" as const, label: "Completed", count: dashboardData?.completed.length ?? 0 },
        { key: "inProgress" as const, label: "In progress", count: dashboardData?.inProgress.length ?? 0 },
        { key: "notStarted" as const, label: "Not started", count: dashboardData?.notStarted.length ?? 0 },
    ];
    const activeItems = teacherTab === "notStarted"
        ? dashboardData?.notStarted ?? []
        : teacherTab === "inProgress"
            ? dashboardData?.inProgress ?? []
            : dashboardData?.completed ?? [];
    const totalPoints = test.questions.reduce((sum, question) => sum + question.points, 0);
    const draftAwarded = selectedAttempt?.responses.reduce((sum, response) => {
        const draft = draftGrades[response.id]?.pointsAwarded;
        return sum + (draft === undefined || draft === "" ? response.pointsAwarded ?? 0 : Number(draft));
    }, 0) ?? 0;

    return (
        <div className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-none md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--classroom-text-faint)]">Assessment review</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--classroom-text)]">{test.title}</h1>
                    </div>
                    <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void fetchInitialData()}>
                        <RefreshCw className="h-3.5 w-3.5" />Refresh
                    </WorkspaceButton>
                </div>
                <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Attempt status">
                    {tabItems.map((item) => (
                        <button key={item.key} type="button" role="tab" aria-selected={teacherTab === item.key} onClick={() => setTeacherTab(item.key)} className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition-colors", teacherTab === item.key ? "border-[var(--classroom-accent-hover)] bg-[var(--classroom-accent)] text-[var(--classroom-text)]" : "border-[var(--classroom-line)] bg-[var(--app-surface)] text-[var(--classroom-text-muted)] hover:bg-[var(--classroom-surface-muted)]")}>
                            {item.label}<span className="ml-2 rounded-md bg-[color-mix(in_srgb,var(--app-surface)_70%,transparent)] px-1.5 py-0.5 text-xs">{item.count}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--classroom-text)]">AI grading drafts</p>
                            <AiUsageStatus usage={gradingUsage} category="GRADING" unit="student" className="bg-[var(--app-surface)]" />
                        </div>
                        {batchProgress ? (
                            <WorkspaceProgress
                                value={batchProgress.total ? Math.round((batchProgress.completed / batchProgress.total) * 100) : 0}
                                label={`${batchProgress.completed} of ${batchProgress.total}${batchProgress.failed ? ` · ${batchProgress.failed} failed` : ""}`}
                                className="mt-2 w-full max-w-sm"
                            />
                        ) : (
                            <p className="mt-1 text-xs text-[var(--classroom-text-muted)]">Separate allowance. Drafts always require your review.</p>
                        )}
                    </div>
                    <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void handleSuggestAllGrades()} disabled={suggestingGrades || gradingExhausted || attemptsNeedingDrafts.length === 0}>
                        {suggestingGrades ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {suggestingGrades ? "Drafting..." : `Draft pending (${Math.min(attemptsNeedingDrafts.length, AI_GRADING_BATCH_SIZE)})`}
                    </WorkspaceButton>
                </div>
            </div>

            <div className="grid min-h-[620px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-3 shadow-none">
                    <div className="max-h-[680px] space-y-1 overflow-y-auto">
                        {activeItems.length === 0 ? (
                            <div className="px-4 py-12 text-center text-sm text-[var(--classroom-text-muted)]">No learners in this state.</div>
                        ) : activeItems.map((item: TeacherTestAttempt | NotStartedLearner) => {
                            const attemptItem = "responses" in item;
                            const selected = attemptItem && item.id === selectedAttemptId;
                            return (
                                <button key={attemptItem ? item.id : item.user.id} type="button" disabled={!attemptItem || teacherTab !== "completed"} onClick={() => attemptItem && setSelectedAttemptId(item.id)} className={cn("w-full rounded-xl border p-3 text-left transition-colors", selected ? "border-[var(--classroom-line-strong)] bg-[var(--classroom-accent)]" : "border-transparent hover:bg-[var(--classroom-surface-muted)]", (!attemptItem || teacherTab !== "completed") && "cursor-default")}>
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface)] text-sm font-semibold text-[var(--classroom-text-muted)]"><UserRound className="h-4 w-4" /></span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-[var(--classroom-text)]">{item.user.name}{attemptItem ? ` · Attempt ${item.attemptNumber}` : ""}</p>
                                            {attemptItem ? <p className="mt-0.5 text-xs text-[var(--classroom-text-muted)]">{item.isCompleted ? new Date(item.submittedAt ?? item.startedAt).toLocaleString() : `Started ${new Date(item.startedAt).toLocaleString()}`}</p> : <p className="text-xs text-[var(--classroom-text-muted)]">No attempt</p>}
                                        </div>
                                    </div>
                                    {attemptItem && item.isCompleted && <div className="mt-2 flex items-center justify-between text-xs"><span className={item.gradingStatus === "NEEDS_REVIEW" ? "text-[var(--app-warning)]" : "text-[var(--app-success)]"}>{item.gradingStatus === "NEEDS_REVIEW" ? `${item.manualResponsesRemaining} to review` : "Graded"}</span><span className="font-semibold text-[var(--classroom-text)]">{item.score == null ? "--" : `${Math.round(item.score)}%`}</span></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="min-w-0 space-y-4">
                    {teacherTab !== "completed" ? (
                        <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-8 text-center shadow-none"><div><h2 className="font-semibold text-[var(--classroom-text)]">{teacherTab === "inProgress" ? "Attempts still in progress" : "Learners who have not started"}</h2><p className="mt-1 text-sm text-[var(--classroom-text-muted)]">Select Completed to inspect and grade submitted work.</p></div></div>
                    ) : !selectedAttempt ? (
                        <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-8 text-center shadow-none"><div><h2 className="font-semibold">Select a completed attempt</h2></div></div>
                    ) : (
                        <>
                            <div className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-none">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-[var(--classroom-text)]">{selectedAttempt.user.name}</h2>
                                        <p className="text-xs text-[var(--classroom-text-muted)]">Attempt {selectedAttempt.attemptNumber} · {selectedAttempt.gradingStatus === "NEEDS_REVIEW" ? "Written answers need review" : "Grading complete"}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void handleSuggestGrades()} disabled={suggestingGrades || gradingExhausted || !selectedAttemptNeedsDrafts}>
                                            {suggestingGrades ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                            {Object.keys(gradeSuggestions).length && !selectedAttemptNeedsDrafts ? "Drafts ready" : "Draft essay grades"}
                                        </WorkspaceButton>
                                        {Object.keys(gradeSuggestions).length > 0 && <WorkspaceButton type="button" variant="secondary" size="compact" onClick={applyAllSuggestions}>Apply all drafts</WorkspaceButton>}
                                    </div>
                                </div>
                            </div>

                            {selectedAttempt.responses.map((response, index) => {
                                const manual = response.question.questionType === "SHORT_ANSWER" || response.question.questionType === "ESSAY";
                                const selectedOption = response.question.options.find((option) => option.id === response.selectedOptionId);
                                const correctOption = response.question.options.find((option) => option.isCorrect);
                                const suggestion = gradeSuggestions[response.id];
                                return (
                                    <div key={response.id} className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-none">
                                        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-[var(--classroom-text-faint)]">Question {index + 1} · {response.question.questionType.replaceAll("_", " ")}</p><h3 className="mt-1 font-semibold leading-6 text-[var(--classroom-text)]">{response.question.questionText}</h3></div><span className="shrink-0 text-xs font-semibold text-[var(--classroom-text-muted)]">{response.question.points} pts</span></div>
                                        <div className="mt-4 rounded-xl bg-[var(--classroom-surface-muted)] p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--classroom-text-faint)]">Learner answer</p><p className="mt-1 whitespace-pre-wrap text-sm text-[var(--classroom-text)]">{response.responseText || selectedOption?.optionText || "No answer"}</p></div>
                                        {(correctOption || response.question.answers?.some((answer) => answer.answerText)) && <p className="mt-2 text-xs text-[var(--classroom-text-muted)]">Expected: {correctOption?.optionText || response.question.answers?.map((answer) => answer.answerText).filter(Boolean).join(" / ")}</p>}
                                        {manual ? (
                                            <div className="mt-4 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                                                <label className="text-xs font-semibold text-[var(--classroom-text-muted)]">Points<input type="number" min={0} max={response.question.points} step="0.5" value={draftGrades[response.id]?.pointsAwarded ?? ""} onChange={(event) => setDraftGrades((current) => ({ ...current, [response.id]: { ...current[response.id], pointsAwarded: event.target.value } }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--classroom-line)] bg-[var(--app-surface)] px-3 text-sm outline-none focus:border-[var(--classroom-focus-border)]" /></label>
                                                <label className="text-xs font-semibold text-[var(--classroom-text-muted)]">Feedback<textarea maxLength={1000} value={draftGrades[response.id]?.teacherComment ?? ""} onChange={(event) => setDraftGrades((current) => ({ ...current, [response.id]: { ...current[response.id], teacherComment: event.target.value } }))} className="mt-1 min-h-20 w-full resize-y rounded-lg border border-[var(--classroom-line)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--classroom-focus-border)]" placeholder="Explain what was done well and what to improve." /></label>
                                                {suggestion && <div className="rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-accent)] p-3 sm:col-span-2"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold text-[var(--classroom-text)]"><Sparkles className="mr-1 inline h-3.5 w-3.5" />AI draft · {suggestion.suggestedScore}/{response.question.points} · {suggestion.confidence === "LOW" ? "Needs close review" : `${suggestion.confidence.toLowerCase()} confidence`}</p><p className="mt-1 text-sm text-[var(--classroom-text-muted)]">{suggestion.feedback}</p></div><WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => applySuggestion(response.id)}>Apply</WorkspaceButton></div></div>}
                                            </div>
                                        ) : <div className="mt-3 text-sm font-medium"><span className={response.isCorrect ? "text-[var(--app-success)]" : "text-[var(--app-danger)]"}>{response.isCorrect ? "Correct" : "Incorrect"}</span><span className="ml-2 text-[var(--classroom-text-muted)]">{response.pointsAwarded ?? 0}/{response.question.points} points</span></div>}
                                    </div>
                                );
                            })}

                            <div className="sticky bottom-4 overflow-hidden rounded-2xl border border-[var(--classroom-line-strong)] bg-[var(--app-surface)] p-4 shadow-lg">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[var(--classroom-text)]">Draft total: {Number.isFinite(draftAwarded) ? draftAwarded : 0} / {totalPoints}</p><p className="text-xs text-[var(--classroom-text-muted)]">Review every written answer before saving.</p></div><WorkspaceButton type="button" variant="primary" onClick={() => void handleSaveGrades()} disabled={grading}><Save className="h-4 w-4" />{grading ? "Saving..." : "Save grades"}</WorkspaceButton></div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
