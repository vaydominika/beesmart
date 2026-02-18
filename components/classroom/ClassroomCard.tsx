"use client";

import React from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Users } from "lucide-react";

interface ClassroomCardProps {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    color?: string | null;
    subject?: string | null;
    role: string;
    memberCount: number;
    creatorName?: string | null;
    onClick: () => void;
}

const CLASSROOM_COLORS: Record<string, string> = {
    "#FEC435": "bg-[#FEC435]",
    "#FF6B6B": "bg-[#FF6B6B]",
    "#4ECDC4": "bg-[#4ECDC4]",
    "#45B7D1": "bg-[#45B7D1]",
    "#96CEB4": "bg-[#96CEB4]",
    "#FFEEAD": "bg-[#FFEEAD]",
    "#DDA0DD": "bg-[#DDA0DD]",
    "#98D8C8": "bg-[#98D8C8]",
};

export function ClassroomCard({
    name,
    description,
    color,
    subject,
    role,
    memberCount,
    creatorName,
    onClick,
}: ClassroomCardProps) {
    const roleLabel = role === "TEACHER" ? "Teacher" : role === "TA" ? "TA" : "Student";
    const roleBg = role === "TEACHER" ? "bg-amber-400/20 text-amber-600" : role === "TA" ? "bg-purple-400/20 text-purple-600" : "bg-blue-400/20 text-blue-600";

    return (
        <FancyCard className="bg-(--theme-card) p-5 group cursor-pointer hover:scale-[1.02] transition-transform duration-200">
            <div onClick={onClick} className="flex flex-col h-full min-h-[180px]">
                {/* Color accent bar */}
                {color && (
                    <div
                        className="w-full h-2 rounded-full mb-3 opacity-80"
                        style={{ backgroundColor: color }}
                    />
                )}

                {/* Subject tag */}
                {subject && (
                    <span className="text-xs font-bold uppercase text-(--theme-text) opacity-50 tracking-wider mb-1">
                        {subject}
                    </span>
                )}

                {/* Title */}
                <h3 className="text-lg md:text-xl font-bold text-(--theme-text) uppercase tracking-tight leading-tight mb-1.5">
                    {name}
                </h3>

                {/* Description */}
                {description && (
                    <p className="text-sm text-(--theme-text) opacity-60 leading-snug line-clamp-2 mb-auto">
                        {description}
                    </p>
                )}
                {!description && <div className="mb-auto" />}

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-(--theme-text)/10">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-(--theme-text) opacity-60">
                            <Users className="h-4 w-4" />
                            <span className="text-sm font-bold">{memberCount}</span>
                        </div>
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${roleBg}`}>
                            {roleLabel}
                        </span>
                    </div>
                    <FancyButton
                        className="text-xs font-bold text-(--theme-text) uppercase px-3 py-0.5"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                    >
                        View
                    </FancyButton>
                </div>
            </div>
        </FancyCard>
    );
}

export { CLASSROOM_COLORS };
