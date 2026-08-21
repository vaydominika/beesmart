"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { ClassroomFeed } from "@/components/classroom/ClassroomFeed";
import { ClassroomPeople } from "@/components/classroom/ClassroomPeople";
import { ClassroomGradebook } from "@/components/classroom/ClassroomGradebook";
import { ClassroomSettings } from "@/components/classroom/ClassroomSettings";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronLeft, Copy, FileText, QrCode, Settings, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { isClassroomStaffRole } from "@/lib/classroom-role";

const TABS = ["Feed", "People", "Grades"] as const;
type Tab = (typeof TABS)[number];

interface ClassroomDetail {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    subject?: string | null;
    role: string;
    creator: { id: string; name: string; avatar?: string | null };
    _count: { members: number; posts: number };
}

export default function ClassroomDetailPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;
    const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("Feed");
    const [codeCopied, setCodeCopied] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const fetchClassroom = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}`);
            if (!res.ok) {
                toast.error(res.status === 403 ? "You are not a member of this classroom." : "Classroom not found.");
                router.push("/classroom");
                return;
            }
            setClassroom(await res.json());
        } catch {
            toast.error("Failed to load classroom.");
            router.push("/classroom");
        } finally {
            setLoading(false);
        }
    }, [classroomId, router]);

    useEffect(() => {
        fetchClassroom();
    }, [fetchClassroom]);

    const copyCode = async () => {
        if (!classroom) return;
        await navigator.clipboard.writeText(classroom.code);
        setCodeCopied(true);
        toast.success("Classroom code copied.");
        window.setTimeout(() => setCodeCopied(false), 2000);
    };

    if (loading) return <div className="classroom-ui flex min-h-full items-center justify-center bg-[var(--classroom-canvas)]"><Spinner /></div>;
    if (!classroom) return null;

    const isTeacher = isClassroomStaffRole(classroom.role);
    const roleLabel = classroom.role === "TEACHING_ASSISTANT" ? "Teaching assistant" : classroom.role.toLowerCase();
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/classroom/join?code=${classroom.code}` : "";

    return (
        <div className="classroom-ui min-h-full bg-[var(--classroom-canvas)]">
            <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-9">
                <header className="mb-5 px-1 py-2 md:px-0 md:py-3">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                            {classroom.subject && (
                                <div className="mb-1 ml-[52px] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--classroom-text-muted)] md:ml-14">
                                    {classroom.subject}
                                </div>
                            )}
                            <div className="flex min-w-0 items-center gap-3 md:gap-4">
                                <button
                                    type="button"
                                    onClick={() => router.push("/classroom")}
                                    aria-label="Back to classrooms"
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--classroom-accent-hover)] bg-(--classroom-accent) text-[var(--classroom-text-muted)] transition-colors hover:bg-(--classroom-accent-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <div className="flex min-w-0 flex-wrap items-center gap-3">
                                    <h1 className="truncate text-2xl font-semibold leading-none tracking-[-0.035em] text-[var(--classroom-text)] md:text-[38px]">{classroom.name}</h1>
                                    <span className="shrink-0 rounded-full bg-[var(--classroom-surface-muted)] px-2.5 py-1 text-[11px] font-medium capitalize text-[var(--classroom-text-muted)]">{roleLabel}</span>
                                </div>
                            </div>
                            {classroom.description && <p className="ml-[52px] mt-2 max-w-2xl text-sm leading-relaxed text-[var(--classroom-text-muted)] md:ml-14">{classroom.description}</p>}
                            <div className="ml-[52px] mt-2 flex items-center gap-4 text-xs text-[var(--classroom-text-muted)] md:ml-14">
                                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {classroom._count.members} members</span>
                                <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> {classroom._count.posts} posts</span>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            {isTeacher && (
                                <button
                                    type="button"
                                    onClick={() => setSettingsOpen(true)}
                                    aria-label="Open classroom settings"
                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                                >
                                    <Settings className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={copyCode}
                                className="flex items-center gap-2 rounded-xl border border-[var(--classroom-accent-hover)] bg-[var(--app-surface)] px-3.5 py-2.5 text-sm text-[var(--classroom-text)] transition-colors hover:bg-[var(--classroom-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                                aria-label={`Copy classroom code ${classroom.code}`}
                            >
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--classroom-text-muted)]">Code</span>
                                <span className="font-semibold tracking-[0.12em]">{classroom.code}</span>
                                {codeCopied ? <Check className="h-4 w-4 text-[var(--app-success)]" /> : <Copy className="h-4 w-4 text-[var(--classroom-text-muted)]" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setQrOpen(true)}
                                aria-label="Show classroom QR code"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--classroom-accent-hover)] bg-(--classroom-accent) text-[var(--classroom-text-muted)] transition-colors hover:bg-(--classroom-accent-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                            >
                                <QrCode className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </header>

                <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--classroom-line)]" aria-label="Classroom sections">
                    {TABS.map((tab) => {
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "relative min-w-fit px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--classroom-focus-border)]",
                                    activeTab === tab ? "text-[var(--classroom-text)]" : "text-[var(--classroom-text-muted)] hover:text-[var(--classroom-text)]",
                                )}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.span
                                        layoutId="classroom-tab-indicator"
                                        className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-(--classroom-accent)"
                                        transition={{ type: "spring", stiffness: 520, damping: 38 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </nav>

                <main>
                    {activeTab === "Feed" && <ClassroomFeed classroomId={classroomId} isTeacher={isTeacher} />}
                    {activeTab === "People" && <ClassroomPeople classroomId={classroomId} isTeacher={classroom.role === "TEACHER"} />}
                    {activeTab === "Grades" && <ClassroomGradebook classroomId={classroomId} isTeacher={isTeacher} />}
                </main>

                {isTeacher && (
                    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                        <DialogContent className="classroom-dialog max-h-[88vh] max-w-xl overflow-y-auto rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-2xl md:p-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-semibold text-[var(--classroom-text)]">Classroom settings</DialogTitle>
                            </DialogHeader>
                            <DialogClose
                                aria-label="Close classroom settings"
                                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-surface)] text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-muted)] hover:text-[var(--classroom-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                            >
                                <X className="h-4 w-4" />
                            </DialogClose>
                            <ClassroomSettings
                                classroom={classroom}
                                onUpdated={fetchClassroom}
                                onDeleted={() => router.push("/classroom")}
                            />
                        </DialogContent>
                    </Dialog>
                )}

                <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                    <DialogContent className="classroom-dialog max-w-sm rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-6 shadow-2xl">
                        <DialogHeader className="pr-10">
                            <DialogTitle className="text-xl font-semibold text-[var(--classroom-text)]">Join {classroom.name}</DialogTitle>
                        </DialogHeader>
                        <DialogClose
                            aria-label="Close classroom join code"
                            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-surface)] text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-muted)] hover:text-[var(--classroom-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                        >
                            <X className="h-4 w-4" />
                        </DialogClose>
                        <div className="mt-3 flex flex-col items-center rounded-xl bg-[var(--classroom-surface-muted)] p-5">
                            <div className="rounded-xl bg-[var(--app-surface)] p-3">
                                {joinUrl && <QRCodeSVG value={joinUrl} size={200} level="M" />}
                            </div>
                            <p className="mt-3 text-sm font-semibold tracking-[0.2em] text-[var(--classroom-text)]">{classroom.code}</p>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
