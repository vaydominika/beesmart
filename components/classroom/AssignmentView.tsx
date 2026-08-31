"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceLoadingState } from "@/components/ui/workspace-state";
import { FileAttachmentChip } from "@/components/ui/file-attachment-chip";
import { ClassroomWorkEditButton } from "@/components/classroom/ClassroomWorkEditButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { formatDateYmd } from "@/lib/date";
import {
    Calendar, Clock, Upload, CheckCircle2, XCircle, Send,
    MessageSquareText, Users
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
    grade?: {
        score: number;
        maxScore?: number | null;
        feedback?: string | null;
        gradedAt?: string | null;
    } | null;
}

interface TeacherSubmissionsView {
    submissions: AssignmentSubmission[];
    notSubmitted: Array<{ user: { id: string; name: string; avatar?: string; email?: string }; status: string }>;
}

const statusLabel = (status?: string | null) => {
    if (!status) return "Not submitted";
    return status.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
};

const statusTone = (status?: string | null) => {
    if (status === "GRADED") return "border-[var(--app-success-border)] bg-[var(--app-success-soft)] text-[var(--app-success)]";
    if (status === "LATE") return "border-[var(--app-warning-border)] bg-[var(--app-warning-soft)] text-[var(--app-warning)]";
    if (status === "SUBMITTED") return "border-[var(--app-info-border)] bg-[var(--app-info-soft)] text-[var(--app-info)]";
    return "border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] text-[var(--classroom-text-muted)]";
};

function ProfileAvatar({ user, className }: { user: { name: string; avatar?: string | null }; className?: string }) {
    return (
        <Avatar className={cn("h-9 w-9 border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)]", className)}>
            <AvatarImage
                src={user.avatar?.trim() || "/images/default_pfp.jpg"}
                alt={`${user.name}'s profile picture`}
                className="object-cover object-center"
            />
            <AvatarFallback className="bg-[var(--classroom-surface-muted)] text-xs font-semibold text-[var(--classroom-text-muted)]">
                {user.name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
        </Avatar>
    );
}

export function AssignmentView({ classroomId, assignmentId, isTeacher }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedStudentId = searchParams.get("student");
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

    const handleAssignmentDeleted = useCallback(() => {
        router.replace(`/classroom/${classroomId}`);
        router.refresh();
    }, [classroomId, router]);

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

    useEffect(() => {
        if (!isTeacher || !allSubmissions) return;
        const requestedSubmission = requestedStudentId
            ? allSubmissions.submissions.find((submission) => submission.user.id === requestedStudentId)
            : null;
        if (requestedSubmission) {
            setSelectedStudentId(requestedStudentId);
            return;
        }
        setSelectedStudentId((current) => current ?? allSubmissions.submissions[0]?.user.id ?? null);
    }, [allSubmissions, isTeacher, requestedStudentId]);

    useEffect(() => {
        if (!selectedStudentId || !allSubmissions) return;
        const submission = allSubmissions.submissions.find((item) => item.user.id === selectedStudentId);
        setGradeScore(submission?.grade ? String(submission.grade.score) : "");
        setGradeFeedback(submission?.grade?.feedback ?? "");
    }, [allSubmissions, selectedStudentId]);

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
        return <WorkspaceLoadingState className="py-20" label="Loading assignment" />;
    }

    if (!assignment) {
        return (
            <div className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-8 text-center shadow-none">
                <XCircle className="mx-auto h-8 w-8 text-[var(--app-danger)]" />
                <h1 className="mt-3 text-lg font-semibold text-[var(--classroom-text)]">Assignment unavailable</h1>
                <p className="mt-1 text-sm text-[var(--classroom-text-muted)]">{assignmentError ?? "Assignment details could not be loaded."}</p>
                <WorkspaceButton type="button" variant="secondary" onClick={() => void fetchAssignmentAndSubmissions()} className="mt-5">Try again</WorkspaceButton>
            </div>
        );
    }

    const displayAssignment = assignment;
    const myGrade = mySubmission?.grade ?? null;
    const myStatus = myGrade ? "Graded" : mySubmission ? statusLabel(mySubmission.status) : "Not submitted";
    const selectedSubmission = allSubmissions?.submissions.find((submission) => submission.user.id === selectedStudentId) ?? null;
    const submittedCount = allSubmissions?.submissions.length ?? 0;
    const studentCount = submittedCount + (allSubmissions?.notSubmitted.length ?? 0);
    const dueDate = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        ...(displayAssignment.deadlineHasTime ? { timeStyle: "short" as const } : {}),
    }).format(new Date(displayAssignment.deadlineAt));

    return (
        <div className="space-y-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--classroom-text)]">{displayAssignment.title}</h1>
                {displayAssignment.description && (
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[var(--classroom-text-muted)]">
                        {displayAssignment.description}
                    </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--classroom-text-muted)]">
                    <div className="flex min-w-0 items-center gap-2">
                        <ProfileAvatar user={displayAssignment.assigner} className="h-7 w-7" />
                        <span className="truncate">
                            Assigned by <strong className="font-semibold text-[var(--classroom-text)]">{displayAssignment.assigner.name}</strong>
                        </span>
                    </div>
                    <span className="hidden h-4 w-px bg-[var(--classroom-line)] sm:block" aria-hidden="true" />
                    <span className="inline-flex items-center gap-1.5 font-medium">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        Due {dueDate}
                        <span className="hidden opacity-70 sm:inline">· {displayAssignment.deadlineTimeZone}</span>
                    </span>
                    {displayAssignment.isGraded && displayAssignment.maxPoints != null && (
                        <>
                            <span className="hidden h-4 w-px bg-[var(--classroom-line)] sm:block" aria-hidden="true" />
                            <span className="inline-flex items-center gap-1.5 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {displayAssignment.maxPoints} points
                                {isTeacher && (
                                    <ClassroomWorkEditButton
                                        classroomId={classroomId}
                                        assignmentId={assignmentId}
                                        title={displayAssignment.title}
                                        onSaved={fetchAssignmentAndSubmissions}
                                        onDeleted={handleAssignmentDeleted}
                                        className="-my-1 ml-0.5"
                                    />
                                )}
                            </span>
                        </>
                    )}
                    {isTeacher && (!displayAssignment.isGraded || displayAssignment.maxPoints == null) && (
                        <>
                            <span className="hidden h-4 w-px bg-[var(--classroom-line)] sm:block" aria-hidden="true" />
                            <ClassroomWorkEditButton
                                classroomId={classroomId}
                                assignmentId={assignmentId}
                                title={displayAssignment.title}
                                onSaved={fetchAssignmentAndSubmissions}
                                onDeleted={handleAssignmentDeleted}
                                className="-my-1"
                            />
                        </>
                    )}
                </div>
                {displayAssignment.files.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--classroom-line)] pt-3" aria-label="Assignment attachments">
                        {displayAssignment.files.map((file) => (
                            <FileAttachmentChip
                                key={file.id}
                                name={file.fileName}
                                href={file.fileUrl}
                                size={file.fileSize}
                                className="border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] text-[var(--classroom-text-muted)]"
                            />
                        ))}
                    </div>
                )}
            </header>

            {submissionsError && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] px-4 py-3 text-sm text-[var(--app-danger)]">
                    <span>{submissionsError}</span>
                    <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void fetchAssignmentAndSubmissions()}>Retry</WorkspaceButton>
                </div>
            )}

            {!isTeacher ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <section className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)]">
                        <div className="flex flex-col gap-2 border-b border-[var(--classroom-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--classroom-text)]">Your submission</h2>
                                <p className="mt-0.5 text-xs text-[var(--classroom-text-muted)]">
                                    {mySubmission ? `Submitted ${formatDateYmd(mySubmission.submittedAt)}` : "Add your work when it is ready."}
                                </p>
                            </div>
                            <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone(myGrade ? "GRADED" : mySubmission?.status))}>
                                {myGrade ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                                {myStatus}
                            </span>
                        </div>

                        {mySubmission && mySubmission.status !== "PENDING" ? (
                            <div className="space-y-5 p-5">
                                {mySubmission.content && (
                                    <div>
                                        <h3 className="text-xs font-semibold text-[var(--classroom-text-muted)]">Submission note</h3>
                                        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[var(--classroom-surface-muted)] p-4 text-sm leading-6 text-[var(--classroom-text)]">{mySubmission.content}</p>
                                    </div>
                                )}
                                {mySubmission.files.length > 0 && (
                                    <div>
                                        <h3 className="mb-2 text-xs font-semibold text-[var(--classroom-text-muted)]">Attached files</h3>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {mySubmission.files.map((file) => (
                                                <FileAttachmentChip key={file.id} name={file.fileName} href={file.fileUrl} size={file.fileSize} className="w-full border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)]" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!mySubmission.content && mySubmission.files.length === 0 && (
                                    <p className="rounded-xl bg-[var(--classroom-surface-muted)] p-4 text-sm text-[var(--classroom-text-muted)]">This submission has no note or files.</p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 p-5">
                                <label className="block">
                                    <span className="mb-2 block text-xs font-semibold text-[var(--classroom-text-muted)]">Submission note</span>
                                    <textarea
                                        value={submissionContent}
                                        onChange={(event) => setSubmissionContent(event.target.value)}
                                        placeholder="Add a note for your teacher..."
                                        className="min-h-32 w-full resize-y rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-4 py-3 text-sm text-[var(--classroom-text)] outline-none placeholder:text-[var(--classroom-text-faint)] focus:border-[var(--classroom-focus-border)] focus:ring-2 focus:ring-[var(--classroom-focus-ring)]"
                                    />
                                </label>
                                {submissionFiles.length > 0 && (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {submissionFiles.map((file, index) => (
                                            <FileAttachmentChip
                                                key={`${file.uploadId}:${index}`}
                                                name={file.fileName}
                                                size={file.fileSize}
                                                onRemove={() => setSubmissionFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                                                className="w-full border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)]"
                                            />
                                        ))}
                                    </div>
                                )}
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <label className="workspace-button inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-within:ring-2 focus-within:ring-[var(--app-focus-ring)]">
                                        <Upload className="h-4 w-4" aria-hidden="true" />
                                        {uploadingFiles ? "Uploading…" : "Attach files"}
                                        <input type="file" multiple onChange={handleFileUpload} className="sr-only" disabled={uploadingFiles} />
                                    </label>
                                    <WorkspaceButton
                                        type="button"
                                        variant="primary"
                                        onClick={handleSubmitWork}
                                        disabled={submitting || (submissionFiles.length === 0 && !submissionContent.trim())}
                                    >
                                        <Send aria-hidden="true" />
                                        {submitting ? "Submitting…" : "Submit work"}
                                    </WorkspaceButton>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="self-start overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] lg:sticky lg:top-4">
                        <div className="p-5">
                            <span className="text-xs font-semibold text-[var(--classroom-text-muted)]">Result</span>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-4xl font-bold tracking-tight text-[var(--classroom-text)]">{myGrade ? myGrade.score : "—"}</span>
                                <span className="text-sm font-semibold text-[var(--classroom-text-muted)]">
                                    {myGrade?.maxScore != null ? `/ ${myGrade.maxScore}` : displayAssignment.maxPoints != null ? `/ ${displayAssignment.maxPoints}` : "points"}
                                </span>
                            </div>
                            <div className="mt-4 border-t border-[var(--classroom-line)] pt-4">
                                <span className="text-xs text-[var(--classroom-text-muted)]">Status</span>
                                <p className="mt-1 text-sm font-semibold text-[var(--classroom-text)]">{myStatus}</p>
                            </div>
                            {myGrade?.feedback && (
                                <div className="mt-4 border-t border-[var(--classroom-line)] pt-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--classroom-text-muted)]">
                                        <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                                        Teacher feedback
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--classroom-text)]">{myGrade.feedback}</p>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            ) : (
                <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)]">
                        <div className="flex min-h-20 items-center justify-between border-b border-[var(--classroom-line)] px-4 py-4">
                            <div>
                                <h2 className="text-sm font-semibold text-[var(--classroom-text)]">Students</h2>
                                <p className="mt-0.5 text-xs text-[var(--classroom-text-muted)]">{submittedCount} of {studentCount} submitted</p>
                            </div>
                            <Users className="h-4 w-4 text-[var(--classroom-text-muted)]" aria-hidden="true" />
                        </div>
                        <ScrollArea className="max-h-[620px]">
                            <div className="space-y-1 p-2">
                                {allSubmissions?.submissions.map((submission) => (
                                    <WorkspaceButton
                                        key={submission.user.id}
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setSelectedStudentId(submission.user.id)}
                                        aria-pressed={selectedStudentId === submission.user.id}
                                        className={cn(
                                            "h-auto w-full justify-start whitespace-normal rounded-xl border px-3 py-2.5 text-left",
                                            selectedStudentId === submission.user.id
                                                ? "border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] text-[var(--classroom-text)]"
                                                : "border-transparent"
                                        )}
                                    >
                                        <ProfileAvatar user={submission.user} className="h-9 w-9" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-[var(--classroom-text)]">{submission.user.name}</span>
                                            <span className={cn("mt-0.5 block text-[11px] font-medium", submission.grade ? "text-[var(--app-success)]" : submission.status === "LATE" ? "text-[var(--app-warning)]" : "text-[var(--classroom-text-muted)]")}>
                                                {submission.grade ? `Graded · ${submission.grade.score}${submission.grade.maxScore != null ? ` / ${submission.grade.maxScore}` : ""}` : statusLabel(submission.status)}
                                            </span>
                                        </span>
                                    </WorkspaceButton>
                                ))}
                                {allSubmissions?.notSubmitted.map(({ user }) => (
                                    <div key={user.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-55">
                                        <ProfileAvatar user={user} className="h-9 w-9 grayscale" />
                                        <div className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-[var(--classroom-text)]">{user.name}</span>
                                            <span className="mt-0.5 block text-[11px] text-[var(--classroom-text-muted)]">Not submitted</span>
                                        </div>
                                    </div>
                                ))}
                                {studentCount === 0 && (
                                    <p className="px-3 py-10 text-center text-sm text-[var(--classroom-text-muted)]">No students are enrolled yet.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </aside>

                    <section className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)]">
                        {selectedSubmission ? (
                            <>
                                <div className="flex min-h-20 flex-col gap-4 border-b border-[var(--classroom-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <ProfileAvatar user={selectedSubmission.user} className="h-11 w-11" />
                                        <div className="min-w-0">
                                            <h2 className="truncate text-lg font-semibold text-[var(--classroom-text)]">{selectedSubmission.user.name}</h2>
                                            <p className="mt-0.5 text-xs text-[var(--classroom-text-muted)]">Submitted {new Date(selectedSubmission.submittedAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <span className={cn("inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone(selectedSubmission.grade ? "GRADED" : selectedSubmission.status))}>
                                        {selectedSubmission.grade
                                            ? `Graded · ${selectedSubmission.grade.score}${selectedSubmission.grade.maxScore != null ? ` / ${selectedSubmission.grade.maxScore}` : ""}`
                                            : statusLabel(selectedSubmission.status)}
                                    </span>
                                </div>

                                <div className="space-y-6 p-5">
                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div>
                                            <h3 className="text-xs font-semibold text-[var(--classroom-text-muted)]">Submission note</h3>
                                            {selectedSubmission.content ? (
                                                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[var(--classroom-surface-muted)] p-4 text-sm leading-6 text-[var(--classroom-text)]">{selectedSubmission.content}</p>
                                            ) : (
                                                <p className="mt-2 text-sm text-[var(--classroom-text-muted)]">No note was added.</p>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-semibold text-[var(--classroom-text-muted)]">Attached files</h3>
                                            {selectedSubmission.files.length > 0 ? (
                                                <div className="mt-2 space-y-2">
                                                    {selectedSubmission.files.map((file) => (
                                                        <FileAttachmentChip key={file.id} name={file.fileName} href={file.fileUrl} size={file.fileSize} className="w-full border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)]" />
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="mt-2 text-sm text-[var(--classroom-text-muted)]">No files were attached.</p>
                                            )}
                                        </div>
                                    </div>

                                    {displayAssignment.isGraded && displayAssignment.maxPoints != null ? (
                                        <div className="border-t border-[var(--classroom-line)] pt-5">
                                            <h3 className="mb-4 text-base font-semibold text-[var(--classroom-text)]">Review and grade</h3>
                                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                                                <label className="block">
                                                    <span className="mb-2 block text-xs font-semibold text-[var(--classroom-text-muted)]">Feedback</span>
                                                    <textarea
                                                        value={gradeFeedback}
                                                        onChange={(event) => setGradeFeedback(event.target.value)}
                                                        placeholder="Add feedback for the student..."
                                                        className="h-20 min-h-20 w-full resize-y rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-4 py-3 text-sm text-[var(--classroom-text)] outline-none placeholder:text-[var(--classroom-text-faint)] focus:border-[var(--classroom-focus-border)] focus:ring-2 focus:ring-[var(--classroom-focus-ring)]"
                                                    />
                                                </label>
                                                <div>
                                                    <label htmlFor="assignment-score" className="mb-2 block text-xs font-semibold text-[var(--classroom-text-muted)]">Score</label>
                                                    <div className="flex h-9 items-center rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 focus-within:border-[var(--classroom-focus-border)] focus-within:ring-2 focus-within:ring-[var(--classroom-focus-ring)]">
                                                        <input
                                                            id="assignment-score"
                                                            type="number"
                                                            min={0}
                                                            max={displayAssignment.maxPoints}
                                                            value={gradeScore}
                                                            onChange={(event) => setGradeScore(event.target.value)}
                                                            placeholder="0"
                                                            className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-[var(--classroom-text)] outline-none"
                                                        />
                                                        <span className="ml-2 border-l border-[var(--classroom-line)] pl-2 text-sm font-semibold text-[var(--classroom-text-muted)]">/ {displayAssignment.maxPoints}</span>
                                                    </div>
                                                    <WorkspaceButton
                                                        type="button"
                                                        variant="primary"
                                                        onClick={() => handleGradeSubmission(selectedSubmission.user.id)}
                                                        disabled={grading || !gradeScore}
                                                        className="mt-2 w-full"
                                                    >
                                                        {grading ? "Saving…" : selectedSubmission.grade ? "Update grade" : "Save grade"}
                                                    </WorkspaceButton>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : (
                            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                                <Users className="h-6 w-6 text-[var(--classroom-text-faint)]" aria-hidden="true" />
                                <h2 className="mt-3 text-sm font-semibold text-[var(--classroom-text)]">No submission selected</h2>
                                <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--classroom-text-muted)]">
                                    {submittedCount > 0 ? "Choose a student to review their work." : "Submitted work will appear here."}
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
