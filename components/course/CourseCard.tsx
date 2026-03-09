"use client";

import { FancyCard } from "@/components/ui/fancycard";
import { BookOpen, Users } from "lucide-react";

interface CourseCardProps {
    id: string;
    title: string;
    description?: string | null;
    isPublic: boolean;
    published?: boolean;
    _count?: {
        modules: number;
        enrollments: number;
    };
    creator?: {
        name: string | null;
    } | null;
    progress?: number;
    onClick?: () => void;
}

export function CourseCard({ title, description, _count, creator, onClick, published, progress }: CourseCardProps) {
    return (
        <FancyCard
            className="flex flex-col h-[200px] cursor-pointer transition-transform hover:scale-[1.02] p-6 bg-(--theme-card) relative"
            onClick={onClick}
        >
            {/* Draft Badge */}
            {!published && (
                <div className="absolute top-4 right-4">
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Draft
                    </span>
                </div>
            )}
            <div className="flex-1 mb-4">
                <h3 className="text-xl md:text-2xl font-black text-(--theme-text) uppercase tracking-tight line-clamp-2 leading-tight mb-2">
                    {title}
                </h3>
            </div>

            {description && (
                <div className="text-sm font-medium text-(--theme-text)/70 uppercase line-clamp-2 mb-4 tracking-tighter">
                    {description}
                </div>
            )}

            {progress !== undefined && progress > 0 && (
                <div className="mb-4 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-(--theme-secondary) uppercase tracking-widest">
                            Progress
                        </span>
                        <span className="text-[10px] font-black text-(--theme-secondary) uppercase tracking-widest">
                            {progress}%
                        </span>
                    </div>
                    <div className="w-full bg-(--theme-bg) h-1.5 rounded-full overflow-hidden">
                        <div
                            className="bg-(--theme-secondary) h-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between text-xs md:text-sm font-bold text-(--theme-text-important) uppercase tracking-wider shrink-0 mt-auto">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {_count?.enrollments || 0}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        {_count?.modules || 0}
                    </span>
                </div>
                {creator?.name && (
                    <span className="truncate max-w-[120px] ml-4 text-right">
                        by {creator.name}
                    </span>
                )}
            </div>
        </FancyCard>
    );
}
