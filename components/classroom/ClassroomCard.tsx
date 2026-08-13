"use client";

import { ArrowUpRight, Users } from "lucide-react";

interface ClassroomCardProps {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    subject?: string | null;
    role: string;
    memberCount: number;
    creatorName?: string | null;
    onClick: () => void;
}

export function ClassroomCard({ name, description, subject, role, memberCount, onClick }: ClassroomCardProps) {
    const roleLabel = role === "TEACHER" ? "Teacher" : role === "TEACHING_ASSISTANT" ? "Teaching assistant" : "Student";
    const roleStyle = role === "TEACHER"
        ? "bg-[var(--classroom-role-teacher-bg)] text-[var(--classroom-role-teacher-text)]"
        : role === "TEACHING_ASSISTANT"
            ? "bg-[var(--classroom-role-assistant-bg)] text-[var(--classroom-role-assistant-text)]"
            : "bg-[var(--classroom-role-student-bg)] text-[var(--classroom-role-student-text)]";

    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative flex min-h-[210px] w-full flex-col overflow-hidden rounded-2xl border border-(--classroom-accent) bg-[var(--app-surface)] p-5 text-left transition-colors duration-200 hover:bg-[var(--classroom-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
        >
            {subject && (
                <span className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--classroom-text-muted)]">{subject}</span>
            )}
            <h2 className="mb-2 text-xl font-semibold leading-tight tracking-[-0.025em] text-[var(--classroom-text)]">{name}</h2>
            {description ? (
                <p className="mb-auto line-clamp-2 text-sm leading-relaxed text-[var(--classroom-text-muted)]">{description}</p>
            ) : (
                <p className="mb-auto text-sm text-[var(--classroom-text-faint)]">No description</p>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-[var(--classroom-line)] pt-4">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--classroom-text-muted)]">
                        <Users className="h-4 w-4" /> {memberCount}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleStyle}`}>{roleLabel}</span>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--classroom-accent-hover)] bg-(--classroom-accent) text-[var(--classroom-text)] transition-colors group-hover:bg-(--classroom-accent-hover)">
                    <ArrowUpRight className="h-4 w-4" />
                </span>
            </div>
        </button>
    );
}
