"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
    Calendar, Clock, FileText, Upload, Paperclip,
    CheckCircle2, XCircle, Send, Plus, X
} from "lucide-react";

interface Props {
    classroomId: string;
    assignmentId: string;
    isTeacher: boolean;
}

interface AssignmentDetails {
    id: string;
    title: string;
    description?: string | null;
    dueDate: string;
    dueTime?: string | null;
    isGraded: boolean;
    maxPoints?: number | null;
    createdAt: string;
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

    // Student specific state
    const [mySubmission, setMySubmission] = useState<AssignmentSubmission | null>(null);
    const [submissionContent, setSubmissionContent] = useState("");
    const [submissionFiles, setSubmissionFiles] = useState<{ fileName: string; fileUrl: string; fileType: string; fileSize: number }[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Teacher specific state
    const [allSubmissions, setAllSubmissions] = useState<TeacherSubmissionsView | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [grading, setGrading] = useState(false);
    const [gradeScore, setGradeScore] = useState("");
    const [gradeFeedback, setGradeFeedback] = useState("");

    const fetchAssignmentAndSubmissions = useCallback(async () => {
        try {
            // First fetch the assignment details (we need a new endpoint for just the assignment,
            // or we use the feed endpoint with a filter. For now, let's assume we can fetch it via the assignments route, 
            // but we might need to rely on the submissions route which has the assignment context implicitly, or fetch feed posts)

            // For now, let's just fetch the submissions and assume we have the assignment details from a parent or we fetch it.
            // Since there's no direct GET /assignment endpoint, we'll get it from the submissions response if we wrap it later.
            // Actually, we need the assignment details. Let's create a GET route if necessary or fetch from posts.
            // Let's rely on the parent page or a specific fetch. Assuming we'll add a simple GET /api/classrooms/[id]/assignments/[assignmentId] later.
            // For now, just focus on submissions.

            const res = await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/submissions`);
            if (!res.ok) {
                toast.error("Failed to load submissions.");
                return;
            }

            const data = await res.json();

            if (isTeacher) {
                setAllSubmissions(data as TeacherSubmissionsView);
            } else {
                setMySubmission(data[0] || null);
            }

            // Fetch assignment details (we'll implement this endpoint if it's missing)
            const assignRes = await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}`);
            if (assignRes.ok) {
                setAssignment(await assignRes.json());
            }

        } catch {
            toast.error("Failed to load assignment details.");
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
                const res = await fetch("/api/upload/local", { method: "POST", body: formData });
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
                    files: submissionFiles,
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

    // Default mock assignment details if API not yet created
    const displayAssignment = assignment || {
        id: assignmentId,
        title: "Loading Assignment Details...",
        dueDate: new Date().toISOString(),
        isGraded: true,
        maxPoints: 100,
        createdAt: new Date().toISOString()
    };

    return (
        <div className="space-y-6">
            {/* Header: Assignment Details */}
            <FancyCard className="bg-(--theme-card) p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-2xl"></div>
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
                                <span>Due: {new Date(displayAssignment.dueDate).toLocaleDateString()}</span>
                                {displayAssignment.dueTime && <span>at {displayAssignment.dueTime}</span>}
                            </div>
                            {displayAssignment.isGraded && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-(--theme-text) opacity-60 bg-(--theme-sidebar) px-2.5 py-1.5 rounded-lg">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>{displayAssignment.maxPoints} Points Possible</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </FancyCard>

            {/* Content Switch based on Role */}
            {!isTeacher ? (
                /* ----------------- STUDENT VIEW ----------------- */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Col: Submission Form */}
                    <div className="lg:col-span-2 space-y-4">
                        <FancyCard className="bg-(--theme-card) p-6">
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
                                            Submitted on {new Date(mySubmission.submittedAt).toLocaleDateString()}
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

                                        <FancyButton
                                            onClick={handleSubmitWork}
                                            disabled={submitting || (submissionFiles.length === 0 && !submissionContent.trim())}
                                            className="px-6 py-2 text-sm font-bold bg-(--theme-text) text-(--theme-card)"
                                        >
                                            <Send className="h-4 w-4 mr-2" />
                                            Submit Work
                                        </FancyButton>
                                    </div>
                                </div>
                            )}
                        </FancyCard>
                    </div>

                    {/* Right Col: Grading Status */}
                    <div className="space-y-4">
                        <FancyCard className="bg-(--theme-card) p-6">
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
                        <FancyCard className="bg-(--theme-card) p-4 flex flex-col h-[600px]">
                            <h3 className="text-sm font-bold text-(--theme-text) mb-4 uppercase tracking-wider">Submissions</h3>

                            <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2">
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
                            </div>
                        </FancyCard>
                    </div>

                    {/* Right Col: Grading Canvas */}
                    <div className="lg:col-span-2 space-y-4">
                        <FancyCard className="bg-(--theme-card) p-6 h-[600px] flex flex-col">
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

                                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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
                                            </div>

                                            {/* Grading Box */}
                                            <div className="bg-(--theme-sidebar) p-4 rounded-xl corner-squircle mt-auto">
                                                <h4 className="text-xs font-bold uppercase tracking-wider mb-3">Grade Assignment</h4>
                                                <div className="flex flex-col md:flex-row gap-4">
                                                    <div className="flex-1">
                                                        <textarea
                                                            value={gradeFeedback}
                                                            onChange={e => setGradeFeedback(e.target.value)}
                                                            placeholder="Add teacher feedback..."
                                                            className="w-full h-full min-h-[80px] bg-(--theme-card) px-3 py-2 rounded-lg text-sm font-bold border-0 outline-none resize-none"
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
                                                        <FancyButton
                                                            onClick={() => handleGradeSubmission(selectedStudentId)}
                                                            disabled={grading || !gradeScore}
                                                            className="w-full py-2 bg-green-500 text-white font-bold text-sm"
                                                        >
                                                            {grading ? "Saving..." : "Save Grade"}
                                                        </FancyButton>
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
