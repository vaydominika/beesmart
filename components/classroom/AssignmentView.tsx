"use client";

import { useState, useEffect, useCallback } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { formatDateYmd } from "@/lib/date";
import {
    Calendar, Clock, FileText, Upload, Paperclip,
    CheckCircle2, XCircle, Send, X
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PostAttachmentFile } from "@/lib/classroom-post-drafts";

interface Props {
    classroomId: string;
    assignmentId: string;
    isTeacher: boolean;
}

interface AssignmentDetails {
    id: string;
    title: string;
    description?: string | null;
    deadlineAt: string;
    deadlineTimeZone: string;
    deadlineHasTime: boolean;
    isGraded: boolean;
    maxPoints?: number | null;
    createdAt: string;
    assigner: { id: string; name: string; avatar?: string | null };
    files: Array<{ id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number }>;
}

interface AssignmentSubmission {
    id: string;
    status: string;
    content?: string | null;
    submittedAt: string;
    user: { id: string; name: string; avatar?: string | null; email?: string };
    files: Array<{ id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number }>;
    _count: { comments: number };
}

interface TeacherSubmissionsView {
    submissions: AssignmentSubmission[];
    notSubmitted: Array<{ user: { id: string; name: string; avatar?: string; email?: string }; status: string }>;
}

export function AssignmentView({ classroomId, assignmentId, isTeacher }: Props) {
    const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [assignmentError, setAssignmentError] = useState<string | null>(null);
    const [submissionsError, setSubmissionsError] = useState<string | null>(null);

    // Student specific state
    const [mySubmission, setMySubmission] = useState<AssignmentSubmission | null>(null);
    const [submissionContent, setSubmissionContent] = useState("");
    const [submissionFiles, setSubmissionFiles] = useState<PostAttachmentFile[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Teacher specific state
    const [allSubmissions, setAllSubmissions] = useState<TeacherSubmissionsView | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [grading, setGrading] = useState(false);
    const [gradeScore, setGradeScore] = useState("");
    const [gradeFeedback, setGradeFeedback] = useState("");

    const fetchAssignmentAndSubmissions = useCallback(async () => {
        setLoading(true);
        setAssignmentError(null);
        setSubmissionsError(null);
        try {
            const [assignmentResult, submissionsResult] = await Promise.allSettled([
                fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}`),
                fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/submissions`),
            ]);

            if (assignmentResult.status === "fulfilled" && assignmentResult.value.ok) {
                setAssignment(await assignmentResult.value.json());
            } else {
                const message = assignmentResult.status === "fulfilled"
                    ? (await assignmentResult.value.json().catch(() => ({}))).error
                    : null;
                setAssignmentError(message || "Assignment details could not be loaded.");
            }

            if (submissionsResult.status === "fulfilled" && submissionsResult.value.ok) {
                const data = await submissionsResult.value.json();
                if (isTeacher) setAllSubmissions(data as TeacherSubmissionsView);
                else setMySubmission(data[0] || null);
            } else {
                setSubmissionsError("Submissions could not be loaded.");
            }
        } catch {
            setAssignmentError("Assignment details could not be loaded.");
            setSubmissionsError("Submissions could not be loaded.");
        } finally {
            setLoading(false);
        }
    }, [classroomId, assignmentId, isTeacher]);

    useEffect(() => {
        fetchAssignmentAndSubmissions();
    }, [fetchAssignmentAndSubmissions]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;
        setUploadingFiles(true);
        try {
            for (const file of Array.from(fileList)) {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("purpose", "SUBMISSION_ATTACHMENT");
                const res = await fetch("/api/uploads", { method: "POST", body: formData });
                if (!res.ok) {
                    toast.error(`Failed to upload ${file.name}`);
                    continue;
                }
                const uploaded = await res.json();
                setSubmissionFiles((prev) => [...prev, uploaded]);
            }
        } catch {
            toast.error("Upload failed.");
        } finally {
            setUploadingFiles(false);
            e.target.value = "";
        }
    };

    const handleSubmitWork = async () => {
        if (!submissionContent.trim() && submissionFiles.length === 0) {
            toast.error("Please add content or attach files to submit.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/submissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: submissionContent.trim(),
                    uploadIds: submissionFiles.map((file) => file.uploadId),
                }),
            });

            if (!res.ok) throw new Error();

            toast.success("Work submitted successfully.");
            setSubmissionContent("");
            setSubmissionFiles([]);
            fetchAssignmentAndSubmissions();

        } catch {
            toast.error("Failed to submit work.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleGradeSubmission = async (studentId: string) => {
        if (!gradeScore) {
            toast.error("Score is required.");
            return;
        }

        setGrading(true);
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/grade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId,
                    score: parseFloat(gradeScore),
                    maxScore: assignment?.maxPoints,
                    feedback: gradeFeedback,
                }),
            });

            if (!res.ok) throw new Error();

            toast.success("Grade saved!");
            setGradeScore("");
            setGradeFeedback("");
            fetchAssignmentAndSubmissions();

        } catch {
            toast.error("Failed to save grade.");
        } finally {
            setGrading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Spinner /></div>;
    }

    if (!assignment) {
        return (
            <FancyCard className="border border-[var(--classroom-line)] bg-white p-8 text-center shadow-none">
                <XCircle className="mx-auto h-8 w-8 text-red-500" />
                <h1 className="mt-3 text-lg font-semibold text-[var(--classroom-text)]">Assignment unavailable</h1>
                <p className="mt-1 text-sm text-[var(--classroom-text-muted)]">{assignmentError ?? "Assignment details could not be loaded."}</p>
                <WorkspaceButton type="button" variant="secondary" onClick={() => void fetchAssignmentAndSubmissions()} className="mt-5">Try again</WorkspaceButton>
            </FancyCard>
        );
    }

    const displayAssignment = assignment;

    return (
        <div className="space-y-6">
            {/* Header: Assignment Details */}
            <FancyCard className="relative overflow-hidden border border-[var(--classroom-line)] bg-white p-6 shadow-none">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-(--theme-text) mb-2">{displayAssignment.title}</h1>
                        {displayAssignment.description && (
                            <p className="text-sm text-(--theme-text) opacity-80 whitespace-pre-wrap mb-4">
                                {displayAssignment.description}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-60 bg-(--theme-sidebar) px-2.5 py-1.5 rounded-lg">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    Due: {new Intl.DateTimeFormat(undefined, {
                                        dateStyle: "medium",
                                        ...(displayAssignment.deadlineHasTime ? { timeStyle: "short" as const } : {}),
                                    }).format(new Date(displayAssignment.deadlineAt))}
                                </span>
                                <span title={`Deadline set in ${displayAssignment.deadlineTimeZone}`}>({displayAssignment.deadlineTimeZone})</span>
                            </div>
                            {displayAssignment.isGraded && displayAssignment.maxPoints != null && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-60 bg-(--theme-sidebar) px-2.5 py-1.5 rounded-lg">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>{displayAssignment.maxPoints} Points Possible</span>
                                </div>
                            )}
                        </div>
                        {displayAssignment.files.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2" aria-label="Assignment attachments">
                                {displayAssignment.files.map((file) => (
                                    <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--classroom-text-muted)] hover:text-[var(--classroom-text)]">
                                        <Paperclip className="h-3.5 w-3.5" />{file.fileName}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </FancyCard>

            {submissionsError && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{submissionsError}</span>
                    <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void fetchAssignmentAndSubmissions()}>Retry</WorkspaceButton>
                </div>
            )}

            {/* Content Switch based on Role */}
            {!isTeacher ? (
                /* ----------------- STUDENT VIEW ----------------- */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Col: Submission Form */}
                    <div className="lg:col-span-2 space-y-4">
                        <FancyCard className="border border-[var(--classroom-line)] bg-white p-6 shadow-none">
                            <h2 className="text-lg font-bold text-(--theme-text) mb-4">Your Work</h2>

                            {mySubmission && mySubmission.status !== "PENDING" ? (
                                <div className="space-y-4">
                                    <div className={cn(
                                        "px-4 py-3 rounded-xl corner-squircle text-sm font-bold flex items-center justify-between",
                                        mySubmission.status === "GRADED" ? "bg-green-500/10 text-green-500" :
                                            mySubmission.status === "LATE" ? "bg-orange-500/10 text-orange-500" :
                                                "bg-blue-500/10 text-blue-500"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            {mySubmission.status === "GRADED" ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                            <span>{mySubmission.status}</span>
                                        </div>
                                        <span className="text-xs opacity-70">
                                            Submitted on {formatDateYmd(mySubmission.submittedAt)}
                                        </span>
                                    </div>

                                    {mySubmission.content && (
                                        <div className="bg-(--theme-sidebar) p-4 rounded-xl corner-squircle">
                                            <p className="text-sm text-(--theme-text) opacity-80 whitespace-pre-wrap">{mySubmission.content}</p>
                                        </div>
                                    )}

                                    {mySubmission.files.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {mySubmission.files.map(f => (
                                                <a
                                                    key={f.id}
                                                    href={f.fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 bg-(--theme-sidebar) px-3 py-2 rounded-lg text-sm font-bold text-(--theme-text) hover:opacity-80 transition-opacity"
                                                >
                                                    <Paperclip className="h-4 w-4 opacity-50" />
                                                    {f.fileName}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <textarea
                                        value={submissionContent}
                                        onChange={(e) => setSubmissionContent(e.target.value)}
                                        placeholder="Add comments or text to your submission..."
                                        className="w-full bg-(--theme-sidebar) rounded-xl corner-squircle text-sm p-4 min-h-[120px] outline-none border border-transparent focus:border-(--theme-text)/20 resize-none font-bold text-(--theme-text)"
                                    ></textarea>

                                    {submissionFiles.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {submissionFiles.map((f, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-(--theme-sidebar) px-3 py-2 rounded-lg text-sm font-bold text-(--theme-text)">
                                                    <Paperclip className="h-4 w-4 opacity-50" />
                                                    <span className="truncate max-w-[200px]">{f.fileName}</span>
                                                    <button onClick={() => setSubmissionFiles(prev => prev.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100 p-1">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 bg-(--theme-sidebar) px-4 py-2 rounded-lg text-sm font-bold text-(--theme-text) cursor-pointer hover:opacity-80 transition-opacity">
                                            <Upload className="h-4 w-4 opacity-50" />
                                            {uploadingFiles ? "Uploading..." : "Attach Files"}
                                            <input type="file" multiple onChange={handleFileUpload} className="hidden" disabled={uploadingFiles} />
                                        </label>

                                        <WorkspaceButton
                                            type="button"
                                            variant="primary"
                                            onClick={handleSubmitWork}
                                            disabled={submitting || (submissionFiles.length === 0 && !submissionContent.trim())}
                                        >
                                            <Send className="h-4 w-4 mr-2" />
                                            Submit Work
                                        </WorkspaceButton>
                                    </div>
                                </div>
                            )}
                        </FancyCard>
                    </div>

                    {/* Right Col: Grading Status */}
                    <div className="space-y-4">
                        <FancyCard className="border border-[var(--classroom-line)] bg-white p-6 shadow-none">
                            <h3 className="text-xs font-bold text-(--theme-text) opacity-50 uppercase tracking-widest mb-4">Grade Status</h3>

                            {mySubmission?.status === "GRADED" ? (
                                <div className="space-y-4">
                                    <div className="text-center p-6 bg-(--theme-sidebar) rounded-xl corner-squircle border border-green-500/20">
                                        <span className="block text-4xl font-black text-green-500 mb-1">
                                            {/* We need to fetch the actual grade here via the gradebook or attach it to the submission response */}
                                            GRADED
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-(--theme-text) text-center opacity-60">
                                        Check the Grades tab for your final score.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center p-6 bg-(--theme-sidebar) rounded-xl corner-squircle">
                                    <span className="text-sm font-bold text-(--theme-text) opacity-50">Not graded yet</span>
                                </div>
                            )}
                        </FancyCard>
                    </div>
                </div>
            ) : (
                /* ----------------- TEACHER VIEW ----------------- */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Col: Student List */}
                    <div className="lg:col-span-1 space-y-4">
                        <FancyCard className="flex h-[600px] flex-col border border-[var(--classroom-line)] bg-white p-4 shadow-none">
                            <h3 className="text-sm font-bold text-(--theme-text) mb-4 uppercase tracking-wider">Submissions</h3>

                            <ScrollArea className="flex-1 space-y-1 -mx-2 px-2">
                                {allSubmissions?.submissions.map(sub => (
                                    <button
                                        key={sub.user.id}
                                        onClick={() => setSelectedStudentId(sub.user.id)}
                                        className={cn(
                                            "w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors",
                                            selectedStudentId === sub.user.id ? "bg-(--theme-sidebar)" : "hover:bg-(--theme-sidebar)/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-(--theme-card) border border-(--theme-text)/10 flex items-center justify-center text-xs font-bold">
                                                {sub.user.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-(--theme-text)">{sub.user.name}</span>
                                                <span className={cn(
                                                    "block text-[10px] font-bold uppercase",
                                                    sub.status === "GRADED" ? "text-green-500" :
                                                        sub.status === "LATE" ? "text-orange-500" :
                                                            "text-blue-500"
                                                )}>{sub.status}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {allSubmissions?.notSubmitted.map(ns => (
                                    <div key={ns.user.id} className="w-full text-left p-3 rounded-lg flex items-center justify-between opacity-50 grayscale">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-(--theme-card) border border-(--theme-text)/10 flex items-center justify-center text-xs font-bold">
                                                {ns.user.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-(--theme-text)">{ns.user.name}</span>
                                                <span className="block text-[10px] font-bold text-(--theme-text) uppercase">Missing</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {(!allSubmissions?.submissions.length && !allSubmissions?.notSubmitted.length) && (
                                    <div className="text-center py-10 opacity-50">
                                        <p className="text-sm font-bold">No students found.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </FancyCard>
                    </div>

                    {/* Right Col: Grading Canvas */}
                    <div className="lg:col-span-2 space-y-4">
                        <FancyCard className="flex h-[600px] flex-col border border-[var(--classroom-line)] bg-white p-6 shadow-none">
                            {!selectedStudentId ? (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                                    <FileText className="h-16 w-16 mb-4" />
                                    <h3 className="text-lg font-bold">Select a student to grade</h3>
                                </div>
                            ) : (() => {
                                const selectedSub = allSubmissions?.submissions.find(s => s.user.id === selectedStudentId);
                                const selectedNs = allSubmissions?.notSubmitted.find(s => s.user.id === selectedStudentId);

                                if (selectedNs) {
                                    return (
                                        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                                            <XCircle className="h-16 w-16 mb-4 text-orange-500" />
                                            <h3 className="text-lg font-bold">No submission yet.</h3>
                                        </div>
                                    );
                                }

                                if (selectedSub) {
                                    return (
                                        <div className="flex-1 flex flex-col gap-6">
                                            <div className="flex items-center justify-between border-b border-(--theme-text)/10 pb-4">
                                                <h3 className="text-xl font-bold text-(--theme-text)">{selectedSub.user.name}&apos;s Work</h3>
                                                <span className="text-sm font-bold text-(--theme-text) opacity-50">
                                                    Submitted {new Date(selectedSub.submittedAt).toLocaleString()}
                                                </span>
                                            </div>

                                            <ScrollArea className="flex-1 space-y-4 pr-2">
                                                {selectedSub.content && (
                                                    <div className="bg-(--theme-sidebar) p-4 rounded-xl corner-squircle">
                                                        <p className="text-sm text-(--theme-text) whitespace-pre-wrap">{selectedSub.content}</p>
                                                    </div>
                                                )}

                                                {selectedSub.files.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-xs font-bold uppercase opacity-50">Attached Files</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {selectedSub.files.map(f => (
                                                                <a
                                                                    key={f.id}
                                                                    href={f.fileUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-3 bg-(--theme-sidebar) p-3 rounded-xl corner-squircle hover:opacity-80 transition-opacity"
                                                                >
                                                                    <div className="w-10 h-10 rounded-lg bg-(--theme-card) flex items-center justify-center">
                                                                        <FileText className="h-5 w-5 text-(--theme-text) opacity-50" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-bold truncate text-(--theme-text)">{f.fileName}</p>
                                                                        <p className="text-[10px] font-bold opacity-50 uppercase">{(f.fileSize / 1024).toFixed(1)} KB</p>
                                                                    </div>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {!selectedSub.content && selectedSub.files.length === 0 && (
                                                    <p className="text-sm opacity-50 italic">Empty submission</p>
                                                )}
                                            </ScrollArea>

                                            {/* Grading Box */}
                                            <div className="bg-(--theme-sidebar) p-4 rounded-xl corner-squircle mt-auto">
                                                <h4 className="text-xs font-bold uppercase tracking-wider mb-3">Review Assignments</h4>
                                                <div className="flex flex-col md:flex-row gap-4">
                                                    <div className="flex-1">
                                                        <textarea
                                                            value={gradeFeedback}
                                                            onChange={e => setGradeFeedback(e.target.value)}
                                                            placeholder="Add teacher feedback..."
                                                            className="h-full min-h-[80px] w-full resize-none rounded-lg border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 py-2 text-sm font-normal outline-none"
                                                        ></textarea>
                                                    </div>
                                                    <div className="w-full md:w-48 flex flex-col gap-2">
                                                        <div className="flex items-center gap-2 bg-(--theme-card) px-3 py-2 rounded-lg">
                                                            <input
                                                                type="number"
                                                                value={gradeScore}
                                                                onChange={e => setGradeScore(e.target.value)}
                                                                placeholder="Score"
                                                                className="w-full bg-transparent border-0 outline-none text-right font-bold text-lg"
                                                            />
                                                            <span className="text-lg font-bold opacity-30">/</span>
                                                            <span className="text-lg font-bold opacity-50">{assignment?.maxPoints || "-"}</span>
                                                        </div>
                                                        <WorkspaceButton
                                                            type="button"
                                                            variant="primary"
                                                            onClick={() => handleGradeSubmission(selectedStudentId)}
                                                            disabled={grading || !gradeScore}
                                                            className="w-full"
                                                        >
                                                            {grading ? "Saving..." : "Save Grade"}
                                                        </WorkspaceButton>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return null;
                            })()}
                        </FancyCard>
                    </div>
                </div>
            )}
        </div>
    );
}
