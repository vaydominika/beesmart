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
        ? "bg-[#fff3bf] text-[#705900]"
        : role === "TEACHING_ASSISTANT"
            ? "bg-[#f1eafe] text-[#6842a6]"
            : "bg-[#eaf2ff] text-[#315f9c]";

    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative flex min-h-[210px] w-full flex-col overflow-hidden rounded-2xl border border-(--classroom-accent) bg-white p-5 text-left transition-colors duration-200 hover:bg-[#fffefa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a]"
        >
            {subject && (
                <span className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8d86]">{subject}</span>
            )}
            <h2 className="mb-2 text-xl font-semibold leading-tight tracking-[-0.025em] text-[#20231f]">{name}</h2>
            {description ? (
                <p className="mb-auto line-clamp-2 text-sm leading-relaxed text-[#6f726c]">{description}</p>
            ) : (
                <p className="mb-auto text-sm text-[#a0a29c]">No description</p>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-[#ecece6] pt-4">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[#6f726c]">
                        <Users className="h-4 w-4" /> {memberCount}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleStyle}`}>{roleLabel}</span>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e8dda0] bg-(--classroom-accent) text-[#343730] transition-colors group-hover:bg-(--classroom-accent-hover)">
                    <ArrowUpRight className="h-4 w-4" />
                </span>
            </div>
        </button>
    );
}
