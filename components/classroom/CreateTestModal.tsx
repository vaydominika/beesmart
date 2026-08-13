"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GripVertical, CheckCircle2, X, Sparkles, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import type { TestDraft } from "@/lib/classroom-post-drafts";

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";

interface QuestionOption {
    optionText: string;
    isCorrect: boolean;
}

interface Question {
    id: string;
    questionText: string;
    questionType: QuestionType;
    points: number;
    options: QuestionOption[];
    correctAnswer?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onAdd: (test: TestDraft) => void;
    classroomId: string;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    MULTIPLE_CHOICE: "Multiple Choice",
    TRUE_FALSE: "True / False",
    SHORT_ANSWER: "Short Answer",
    ESSAY: "Essay",
};

const DIFFICULTY_OPTIONS = [
    { value: "Beginner", label: "Beginner" },
    { value: "Intermediate", label: "Intermediate" },
    { value: "Advanced", label: "Advanced" },
] as const;

type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]["value"];

type SourceCourse = { id: string; title: string; relationship?: string; classrooms?: Array<{ id: string }> };

export function CreateTestModal({ open, onClose, onAdd, classroomId }: Props) {
    const nextQuestionId = useRef(2);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [testType, setTestType] = useState<"TEST" | "EXAM">("TEST");
    const [timeLimit, setTimeLimit] = useState("");
    const [passingScore, setPassingScore] = useState("");
    const [maxAttempts, setMaxAttempts] = useState("1");
    const [opensAt, setOpensAt] = useState("");
    const [closesAt, setClosesAt] = useState("");
    const [courseId, setCourseId] = useState("");
    const [sourceMode, setSourceMode] = useState<"course" | "text">("course");
    const [sourceText, setSourceText] = useState("");
    const [sourceCourses, setSourceCourses] = useState<SourceCourse[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate");
    const [questionCount, setQuestionCount] = useState(5);
    const [generating, setGenerating] = useState(false);
    const [questions, setQuestions] = useState<Question[]>([
        {
            id: "question-1",
            questionText: "",
            questionType: "MULTIPLE_CHOICE",
            points: 1,
            options: [
                { optionText: "", isCorrect: true },
                { optionText: "", isCorrect: false },
                { optionText: "", isCorrect: false },
                { optionText: "", isCorrect: false },
            ],
        },
    ]);

    useEffect(() => {
        if (!open) return;
        let active = true;
        fetch("/api/courses?source=all")
            .then(async (response) => {
                if (!response.ok) throw new Error("Could not load courses");
                return response.json() as Promise<SourceCourse[]>;
            })
            .then((items) => {
                if (!active) return;
                setSourceCourses(items.filter((course) => course.relationship === "owner" || course.classrooms?.some((classroom) => classroom.id === classroomId)));
            })
            .catch(() => active && toast.error("Course sources could not be loaded."));
        return () => { active = false; };
    }, [classroomId, open]);

    const generateTest = async () => {
        if (sourceMode === "course" && !courseId) {
            toast.error("Choose a source course first.");
            return;
        }
        if (sourceMode === "text" && sourceText.trim().length < 50) {
            toast.error("Paste at least 50 characters of source text.");
            return;
        }
        setGenerating(true);
        try {
            const endpoint = sourceMode === "course"
                ? `/api/courses/${courseId}/tests/generate`
                : `/api/classrooms/${classroomId}/tests/generate-from-text`;
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim() || undefined,
                    description: description.trim() || undefined,
                    classroomId,
                    difficulty,
                    questionCount,
                    sourceText: sourceMode === "text" ? sourceText.trim() : undefined,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Test generation failed");
            setTitle(result.test.title);
            setDescription(result.test.description || "");
            setQuestions(result.test.questions.map((question: { text: string; type: QuestionType; points?: number; options?: Array<{ text: string; isCorrect: boolean }>; correctAnswer?: string }, index: number) => ({
                id: `question-${Date.now()}-${index}`,
                questionText: question.text,
                questionType: question.type,
                points: Math.max(1, Number(question.points) || 1),
                options: question.type === "TRUE_FALSE"
                    ? [
                        { optionText: "True", isCorrect: question.correctAnswer?.toLowerCase() === "true" },
                        { optionText: "False", isCorrect: question.correctAnswer?.toLowerCase() === "false" },
                    ]
                    : (question.options ?? []).map((option) => ({ optionText: option.text, isCorrect: option.isCorrect })),
                correctAnswer: question.correctAnswer,
            })));
            toast.success("Generated draft loaded. Review every question before adding it.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Test generation failed");
        } finally {
            setGenerating(false);
        }
    };

    const addQuestion = () => {
        setQuestions((prev) => [
            ...prev,
            {
                id: `question-${nextQuestionId.current++}`,
                questionText: "",
                questionType: "MULTIPLE_CHOICE",
                points: 1,
                options: [
                    { optionText: "", isCorrect: true },
                    { optionText: "", isCorrect: false },
                ],
            },
        ]);
    };

    const removeQuestion = (index: number) => {
        if (questions.length <= 1) return;
        setQuestions((prev) => prev.filter((_, i) => i !== index));
    };

    const handleQuestionDragEnd = ({ source, destination }: DropResult) => {
        if (!destination || source.index === destination.index) return;

        setQuestions((prev) => {
            const reordered = [...prev];
            const [movedQuestion] = reordered.splice(source.index, 1);
            reordered.splice(destination.index, 0, movedQuestion);
            return reordered;
        });
    };

    const updateQuestion = <K extends keyof Question>(index: number, field: K, value: Question[K]) => {
        setQuestions((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            // When changing question type, adjust options
            if (field === "questionType") {
                if (value === "TRUE_FALSE") {
                    updated[index].options = [
                        { optionText: "True", isCorrect: true },
                        { optionText: "False", isCorrect: false },
                    ];
                } else if (value === "SHORT_ANSWER" || value === "ESSAY") {
                    updated[index].options = [];
                } else if (updated[index].options.length === 0) {
                    updated[index].options = [
                        { optionText: "", isCorrect: true },
                        { optionText: "", isCorrect: false },
                    ];
                }
            }
            return updated;
        });
    };

    const addOption = (qIndex: number) => {
        setQuestions((prev) => {
            const updated = [...prev];
            updated[qIndex] = {
                ...updated[qIndex],
                options: [...updated[qIndex].options, { optionText: "", isCorrect: false }],
            };
            return updated;
        });
    };

    const removeOption = (qIndex: number, oIndex: number) => {
        setQuestions((prev) => {
            const updated = [...prev];
            const opts = updated[qIndex].options.filter((_, i) => i !== oIndex);
            // Ensure at least one is correct
            if (!opts.some((o) => o.isCorrect) && opts.length > 0) {
                opts[0].isCorrect = true;
            }
            updated[qIndex] = { ...updated[qIndex], options: opts };
            return updated;
        });
    };

    const updateOption = <K extends keyof QuestionOption>(qIndex: number, oIndex: number, field: K, value: QuestionOption[K]) => {
        setQuestions((prev) => {
            const updated = [...prev];
            const opts = [...updated[qIndex].options];

            if (field === "isCorrect" && value === true) {
                // Only one correct answer for MC and TF
                opts.forEach((o, i) => (opts[i] = { ...o, isCorrect: i === oIndex }));
            } else {
                opts[oIndex] = { ...opts[oIndex], [field]: value };
            }

            updated[qIndex] = { ...updated[qIndex], options: opts };
            return updated;
        });
    };

    const handleSave = () => {
        if (!title.trim()) {
            toast.error("Please enter a title.");
            return;
        }
        if (closesAt && !opensAt) {
            toast.error("Choose an opening date before the closing date.");
            return;
        }
        if (opensAt && closesAt && new Date(closesAt) < new Date(opensAt)) {
            toast.error("Closing time must be after opening time.");
            return;
        }
        if (!Number.isSafeInteger(Number(maxAttempts)) || Number(maxAttempts) < 1) {
            toast.error("Attempts allowed must be a positive integer.");
            return;
        }

        // Validate questions
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.questionText.trim()) {
                toast.error(`Question ${i + 1} needs text.`);
                return;
            }
            if (q.questionType === "MULTIPLE_CHOICE" || q.questionType === "TRUE_FALSE") {
                if (!q.options.some((o) => o.isCorrect && o.optionText.trim())) {
                    toast.error(`Question ${i + 1} needs a correct answer.`);
                    return;
                }
                if (q.options.filter((o) => o.optionText.trim()).length < 2) {
                    toast.error(`Question ${i + 1} needs at least 2 options.`);
                    return;
                }
            }
            if (q.questionType === "SHORT_ANSWER" && !(q.correctAnswer ?? "").split("\n").some((answer) => answer.trim())) {
                toast.error(`Question ${i + 1} needs at least one accepted answer.`);
                return;
            }
        }

        const payload: TestDraft = {
                courseId: sourceMode === "course" ? courseId || null : null,
                title: title.trim(),
                description: description.trim() || null,
                type: testType,
                timeLimit: timeLimit || null,
                passingScore: passingScore || null,
                opensAt: opensAt || null,
                closesAt: closesAt || null,
                maxAttempts: Number(maxAttempts),
                questions: questions.map((q) => ({
                    questionText: q.questionText.trim(),
                    questionType: q.questionType,
                    points: q.points,
                    options:
                        q.questionType === "MULTIPLE_CHOICE" || q.questionType === "TRUE_FALSE"
                            ? q.options
                                .filter((o) => o.optionText.trim())
                                .map((o) => ({
                                    optionText: o.optionText.trim(),
                                    isCorrect: o.isCorrect,
                                }))
                            : undefined,
                    correctAnswer:
                        q.questionType === "SHORT_ANSWER" ? q.correctAnswer?.trim() || null : null,
                    acceptedAnswers: q.questionType === "SHORT_ANSWER"
                        ? (q.correctAnswer ?? "").split("\n").map((answer) => answer.trim()).filter(Boolean)
                        : undefined,
                })),
            };

        onAdd(payload);
        toast.success(`${testType === "EXAM" ? "Exam" : "Test"} added to post.`);
        setTitle("");
        setDescription("");
        setTestType("TEST");
        setTimeLimit("");
        setPassingScore("");
        setMaxAttempts("1");
        setOpensAt("");
        setClosesAt("");
        setCourseId("");
        setSourceMode("course");
        setSourceText("");
        setQuestions([
            {
                id: "question-1",
                questionText: "",
                questionType: "MULTIPLE_CHOICE",
                points: 1,
                options: [
                    { optionText: "", isCorrect: true },
                    { optionText: "", isCorrect: false },
                    { optionText: "", isCorrect: false },
                    { optionText: "", isCorrect: false },
                ],
            },
        ]);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="classroom-dialog h-[calc(100dvh-1rem)] max-w-4xl overflow-hidden rounded-2xl border border-[var(--classroom-line-strong)] bg-white p-0 shadow-2xl md:h-[94vh] md:max-h-[880px]">
                <DialogClose
                    aria-label="Close test builder"
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-muted)] hover:text-[var(--classroom-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                >
                    <X className="h-4 w-4" />
                </DialogClose>
                <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-white p-4 shadow-none md:p-5">
                  <div className="h-full min-h-0 flex flex-col">
                    <DialogHeader className="shrink-0 border-b border-[var(--classroom-line)] pb-4 pr-10 text-left">
                        <DialogTitle className="text-lg font-semibold text-(--theme-text) md:text-xl">
                            Create {testType === "EXAM" ? "Exam" : "Test"}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 min-h-0">
                        <div className="space-y-4 pb-1 pl-1 pr-3 pt-3">
                            <div className="rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] p-4">
                                <div className="flex items-start gap-3">
                                    <Sparkles className="mt-0.5 h-5 w-5 text-[var(--classroom-text-muted)]" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-[var(--classroom-text)]">Generate an editable draft</p>
                                        <p className="mt-1 text-xs text-[var(--classroom-text-muted)]">Questions stay local to this post until you review, add, and publish them.</p>
                                    </div>
                                </div>
                                <WorkspaceTabs ariaLabel="Generation source" value={sourceMode} onValueChange={setSourceMode} items={[{ value: "course", label: "Course" }, { value: "text", label: "Text" }]} size="compact" fill className="mt-3 bg-white!" />
                                {sourceMode === "course" ? (
                                    <WorkspaceSelect
                                        ariaLabel="Source course"
                                        value={courseId}
                                        options={sourceCourses.map((course) => ({ value: course.id, label: course.title }))}
                                        onValueChange={setCourseId}
                                        placeholder="Choose source course"
                                        className="mt-3 h-10 w-full rounded-xl border-0 bg-white!"
                                    />
                                ) : (
                                    <label className="mt-3 block">
                                        <span className="sr-only">Source text</span>
                                        <textarea value={sourceText} maxLength={20000} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste notes, a lesson, an article, or any source material..." className="min-h-32 w-full resize-y rounded-xl border-0 bg-white! px-3 py-2.5 text-sm leading-6 text-[var(--classroom-text)] outline-none focus:ring-2 focus:ring-[var(--classroom-focus-border)]" />
                                        <span className="mt-1 block text-right text-[10px] text-[var(--classroom-text-muted)]">{sourceText.length}/20,000</span>
                                    </label>
                                )}
                                <div className="mt-3 grid items-end gap-3 sm:grid-cols-3">
                                    <label>
                                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--classroom-text-muted)]">Difficulty</span>
                                        <WorkspaceSelect ariaLabel="Difficulty" value={difficulty} options={DIFFICULTY_OPTIONS} onValueChange={setDifficulty} className="h-10 w-full rounded-xl border-0 bg-white" />
                                    </label>
                                    <label>
                                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--classroom-text-muted)]">Question count</span>
                                        <Input aria-label="Question count" type="number" min={1} max={20} value={questionCount} onChange={(event) => setQuestionCount(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} className="h-10 rounded-xl border-0 bg-white! shadow-none" />
                                    </label>
                                    <WorkspaceButton type="button" variant="secondary" className="h-10 w-full rounded-xl" onClick={generateTest} disabled={generating || (sourceMode === "course" ? !courseId : sourceText.trim().length < 50)}>
                                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate
                                    </WorkspaceButton>
                                </div>
                            </div>
                            {/* Basic Info */}
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Title *</label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                                        placeholder="e.g. Midterm Exam"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Attempts allowed</label>
                                    <Input
                                        type="number"
                                        value={maxAttempts}
                                        onChange={(e) => setMaxAttempts(e.target.value)}
                                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                                        min="1"
                                        step="1"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Type</label>
                                    <WorkspaceTabs
                                        ariaLabel="Assessment type"
                                        value={testType}
                                        onValueChange={setTestType}
                                        items={[{ value: "TEST", label: "Test" }, { value: "EXAM", label: "Exam" }]}
                                        fill
                                        className="h-10"
                                        tabClassName="h-8"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 outline-none ring-0 focus:ring-2 focus:ring-(--theme-card) min-h-[50px] w-full p-3 resize-none"
                                    placeholder="Instructions..."
                                />
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Time Limit (min)</label>
                                    <Input
                                        type="number"
                                        value={timeLimit}
                                        onChange={(e) => setTimeLimit(e.target.value)}
                                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                                        placeholder="No limit"
                                        min="1"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Passing Score (%)</label>
                                    <Input
                                        type="number"
                                        value={passingScore}
                                        onChange={(e) => setPassingScore(e.target.value)}
                                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                                        placeholder="Optional"
                                        min="0"
                                        max="100"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Opens At</label>
                                    <Input
                                        type="datetime-local"
                                        value={opensAt}
                                        onChange={(e) => setOpensAt(e.target.value)}
                                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Closes At</label>
                                    <Input
                                        type="datetime-local"
                                        value={closesAt}
                                        onChange={(e) => setClosesAt(e.target.value)}
                                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Questions */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-(--theme-text) uppercase">Questions</label>
                                    <span className="text-xs text-(--theme-text) opacity-40">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
                                </div>

                                <DragDropContext onDragEnd={handleQuestionDragEnd}>
                                    <Droppable droppableId="test-questions">
                                        {(droppableProvided) => (
                                            <div
                                                ref={droppableProvided.innerRef}
                                                {...droppableProvided.droppableProps}
                                                className="space-y-4"
                                            >
                                    {questions.map((q, qIndex) => (
                                        <Draggable key={q.id} draggableId={q.id} index={qIndex}>
                                            {(draggableProvided, snapshot) => (
                                        <div
                                            ref={draggableProvided.innerRef}
                                            {...draggableProvided.draggableProps}
                                            className={cn(
                                                "bg-(--theme-sidebar) rounded-xl corner-squircle p-4 space-y-3 transition-shadow",
                                                snapshot.isDragging && "ring-2 ring-(--theme-card) shadow-lg",
                                            )}
                                        >
                                            {/* Question Header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        {...draggableProvided.dragHandleProps}
                                                        aria-label={`Move question ${qIndex + 1}`}
                                                        className="-ml-1 flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-md text-(--theme-text) opacity-40 transition-opacity hover:opacity-80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--theme-card) active:cursor-grabbing"
                                                    >
                                                        <GripVertical className="h-4 w-4" />
                                                    </button>
                                                    <span className="text-xs font-bold text-(--theme-text) opacity-60">
                                                        Q{qIndex + 1}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={q.points}
                                                        onChange={(e) => updateQuestion(qIndex, "points", parseInt(e.target.value) || 1)}
                                                        className="bg-(--theme-bg) rounded-lg text-xs font-bold border-0 h-7 w-16 text-center"
                                                        min="1"
                                                    />
                                                    <span className="text-[10px] text-(--theme-text) opacity-40">pts</span>
                                                    {questions.length > 1 && (
                                                        <button
                                                            onClick={() => removeQuestion(qIndex)}
                                                            className="text-red-400 hover:text-red-500 p-1"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Question Type Selector */}
                                            <WorkspaceTabs
                                                ariaLabel={`Question ${qIndex + 1} type`}
                                                value={q.questionType}
                                                onValueChange={(value) => updateQuestion(qIndex, "questionType", value)}
                                                items={(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(([value, label]) => ({ value, label }))}
                                                fill
                                                className="h-10 bg-(--theme-bg)"
                                                tabClassName="h-8 px-2 text-xs"
                                            />

                                            {/* Question Text */}
                                            <textarea
                                                value={q.questionText}
                                                onChange={(e) => updateQuestion(qIndex, "questionText", e.target.value)}
                                                className="bg-(--theme-bg) rounded-lg text-sm font-bold border-0 outline-none ring-0 focus:ring-2 focus:ring-(--theme-card) min-h-[40px] w-full p-2.5 resize-none"
                                                placeholder="Enter your question..."
                                            />

                                            {/* Options for MC / TF */}
                                            {(q.questionType === "MULTIPLE_CHOICE" || q.questionType === "TRUE_FALSE") && (
                                                <div className="space-y-2">
                                                    {q.options.map((opt, oIndex) => (
                                                        <div key={oIndex} className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => updateOption(qIndex, oIndex, "isCorrect", true)}
                                                                className={cn(
                                                                    "shrink-0 transition-colors",
                                                                    opt.isCorrect
                                                                        ? "text-green-500"
                                                                        : "text-(--theme-text) opacity-30 hover:opacity-60"
                                                                )}
                                                                title={opt.isCorrect ? "Correct answer" : "Mark as correct"}
                                                            >
                                                                <CheckCircle2 className="h-5 w-5" />
                                                            </button>
                                                            <Input
                                                                value={opt.optionText}
                                                                onChange={(e) =>
                                                                    updateOption(qIndex, oIndex, "optionText", e.target.value)
                                                                }
                                                                className="h-10 flex-1 rounded-xl border-0 bg-(--theme-bg) text-sm font-bold focus-visible:ring-1 focus-visible:ring-(--theme-card)"
                                                                placeholder={`Option ${oIndex + 1}`}
                                                                disabled={q.questionType === "TRUE_FALSE"}
                                                            />
                                                            {q.questionType === "MULTIPLE_CHOICE" && q.options.length > 2 && (
                                                                <button
                                                                    onClick={() => removeOption(qIndex, oIndex)}
                                                                    className="text-(--theme-text) opacity-30 hover:text-red-400 p-1"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {q.questionType === "MULTIPLE_CHOICE" && q.options.length < 6 && (
                                                        <button
                                                            onClick={() => addOption(qIndex)}
                                                            className="text-xs font-bold text-(--theme-text) opacity-40 hover:opacity-80 flex items-center gap-1 ml-7"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                            Add option
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Short Answer correct answer */}
                                            {q.questionType === "SHORT_ANSWER" && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-(--theme-text) opacity-50 mb-1">
                                                        Correct Answer (for auto-grading)
                                                    </label>
                                                    <textarea
                                                        value={q.correctAnswer || ""}
                                                        onChange={(e) => updateQuestion(qIndex, "correctAnswer", e.target.value)}
                                                        className="min-h-20 w-full resize-y rounded-lg border-0 bg-(--theme-bg) p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-(--theme-card)"
                                                        placeholder="One accepted answer per line"
                                                    />
                                                    <p className="mt-1 text-[10px] text-(--theme-text) opacity-50">Automatically graded after case, whitespace, and Unicode normalization.</p>
                                                </div>
                                            )}

                                            {/* Essay note */}
                                            {q.questionType === "ESSAY" && (
                                                <p className="text-[10px] text-(--theme-text) opacity-40 italic">
                                                    Essay questions require manual grading.
                                                </p>
                                            )}
                                        </div>
                                            )}
                                        </Draggable>
                                    ))}
                                                {droppableProvided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>

                                <button
                                    onClick={addQuestion}
                                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-50 hover:opacity-100 transition-opacity"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Question
                                </button>
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-[var(--classroom-line)] pt-3">
                        <WorkspaceButton type="button" variant="secondary" className="h-10 rounded-xl" onClick={onClose}>
                            Cancel
                        </WorkspaceButton>
                        <WorkspaceButton type="button" variant="primary" className="h-10 rounded-xl" onClick={handleSave}>
                            Add {testType === "EXAM" ? "exam" : "test"}
                        </WorkspaceButton>
                    </div>
                  </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
