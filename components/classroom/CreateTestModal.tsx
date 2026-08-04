"use client";

import { useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GripVertical, CheckCircle2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    MULTIPLE_CHOICE: "Multiple Choice",
    TRUE_FALSE: "True / False",
    SHORT_ANSWER: "Short Answer",
    ESSAY: "Essay",
};

export function CreateTestModal({ open, onClose, onAdd }: Props) {
    const nextQuestionId = useRef(2);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [testType, setTestType] = useState<"TEST" | "EXAM">("TEST");
    const [timeLimit, setTimeLimit] = useState("");
    const [passingScore, setPassingScore] = useState("");
    const [opensAt, setOpensAt] = useState("");
    const [closesAt, setClosesAt] = useState("");
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

    const updateQuestion = (index: number, field: keyof Question, value: any) => {
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

    const updateOption = (qIndex: number, oIndex: number, field: keyof QuestionOption, value: any) => {
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
        }

        const payload: TestDraft = {
                title: title.trim(),
                description: description.trim() || null,
                type: testType,
                timeLimit: timeLimit || null,
                passingScore: passingScore || null,
                opensAt: opensAt || null,
                closesAt: closesAt || null,
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
                })),
            };

        onAdd(payload);
        toast.success(`${testType === "EXAM" ? "Exam" : "Test"} added to post.`);
        setTitle("");
        setDescription("");
        setTestType("TEST");
        setTimeLimit("");
        setPassingScore("");
        setOpensAt("");
        setClosesAt("");
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
            <DialogContent className="classroom-dialog h-[calc(100dvh-1rem)] max-w-4xl overflow-hidden rounded-2xl border border-[#deded7] bg-white p-0 shadow-2xl md:h-[94vh] md:max-h-[880px]">
                <DialogClose
                    aria-label="Close test builder"
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#777a73] transition-colors hover:bg-[#f2f2ee] hover:text-[#20231f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a]"
                >
                    <X className="h-4 w-4" />
                </DialogClose>
                <FancyCard className="h-full min-h-0 bg-white p-4 shadow-none md:p-5">
                  <div className="h-full min-h-0 flex flex-col">
                    <DialogHeader className="shrink-0 border-b border-[#ecece6] pb-4 pr-10 text-left">
                        <DialogTitle className="text-lg font-semibold text-(--theme-text) md:text-xl">
                            Create {testType === "EXAM" ? "Exam" : "Test"}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 min-h-0">
                        <div className="space-y-4 pl-1 pr-3 py-1">
                            {/* Basic Info */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Title *</label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                                        placeholder="e.g. Midterm Exam"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Type</label>
                                    <div className="flex gap-1">
                                        {(["TEST", "EXAM"] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => setTestType(t)}
                                                className={cn(
                                                    "text-xs font-bold px-3 py-2 rounded-lg flex-1 transition-all",
                                                    testType === t
                                                        ? "bg-(--theme-card) text-(--theme-text)"
                                                        : "bg-(--theme-sidebar) text-(--theme-text) opacity-50"
                                                )}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
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
                                            <div className="flex flex-wrap gap-1">
                                                {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(
                                                    ([key, label]) => (
                                                        <button
                                                            key={key}
                                                            onClick={() => updateQuestion(qIndex, "questionType", key)}
                                                            className={cn(
                                                                "text-[10px] font-bold px-2 py-1 rounded-md transition-all",
                                                                q.questionType === key
                                                                    ? "bg-(--theme-card) text-(--theme-text)"
                                                                    : "bg-(--theme-bg) text-(--theme-text) opacity-50 hover:opacity-80"
                                                            )}
                                                        >
                                                            {label}
                                                        </button>
                                                    )
                                                )}
                                            </div>

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
                                                                className="bg-(--theme-bg) rounded-lg text-sm font-bold border-0 focus-visible:ring-1 focus-visible:ring-(--theme-card) h-9 flex-1"
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
                                                    <Input
                                                        value={q.correctAnswer || ""}
                                                        onChange={(e) => updateQuestion(qIndex, "correctAnswer", e.target.value)}
                                                        className="bg-(--theme-bg) rounded-lg text-sm font-bold border-0 focus-visible:ring-1 focus-visible:ring-(--theme-card) h-9 w-full"
                                                        placeholder="Expected answer"
                                                    />
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

                    <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-[#ecece6] pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 rounded-xl border border-[#e6e6e0] bg-white px-4 text-sm font-medium text-[#4d504a] transition-colors hover:bg-[#f7f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="h-9 rounded-xl border border-[#e8dda0] bg-(--classroom-accent) px-4 text-sm font-semibold text-[#20231f] transition-colors hover:bg-(--classroom-accent-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Add {testType === "EXAM" ? "exam" : "test"}
                        </button>
                    </div>
                  </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
