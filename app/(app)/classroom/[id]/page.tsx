"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { ClassroomFeed } from "@/components/classroom/ClassroomFeed";
import { ClassroomPeople } from "@/components/classroom/ClassroomPeople";
import { ClassroomGradebook } from "@/components/classroom/ClassroomGradebook";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassroomSettings } from "@/components/classroom/ClassroomSettings";
import { AnnouncementBanner } from "@/components/classroom/AnnouncementBanner";
import { ArrowLeft, Settings, Copy, Check } from "lucide-react";
import { HugeiconsIcon } from '@hugeicons/react';
import { Notification01Icon } from '@hugeicons/core-free-icons';
import { cn } from "@/lib/utils";

const TABS = ["Feed", "People", "Grades", "Settings"] as const;
type Tab = (typeof TABS)[number];

interface ClassroomDetail {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    color?: string | null;
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

    // Announcement state hoisted for Bell placement
    const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
    const [showDismissedAnnouncements, setShowDismissedAnnouncements] = useState(false);

    const fetchClassroom = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}`);
            if (!res.ok) {
                if (res.status === 403) toast.error("You are not a member of this classroom.");
                else if (res.status === 404) toast.error("Classroom not found.");
                router.push("/classroom");
                return;
            }
            const data = await res.json();
            setClassroom(data);
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

    const copyCode = () => {
        if (!classroom) return;
        navigator.clipboard.writeText(classroom.code);
        setCodeCopied(true);
        toast.success("Code copied!");
        setTimeout(() => setCodeCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full py-20">
                <Spinner />
            </div>
        );
    }

    if (!classroom) return null;

    const isTeacher = classroom.role === "TEACHER" || classroom.role === "TA";

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <FancyButton
                        onClick={() => router.push("/classroom")}
                        className="text-(--theme-text) p-2"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </FancyButton>
                    <div>
                        <div className="flex items-center gap-3">
                            {classroom.color && (
                                <div
                                    className="w-4 h-4 rounded-full shrink-0"
                                    style={{ backgroundColor: classroom.color }}
                                />
                            )}
                            <h1 className="text-2xl md:text-4xl font-bold text-(--theme-text) uppercase tracking-tight">
                                {classroom.name}
                            </h1>
                        </div>
                        {classroom.subject && (
                            <p className="text-sm text-(--theme-text) opacity-50 uppercase tracking-wider ml-7">
                                {classroom.subject}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right Header Group: Bell + Code Badge */}
                <div className="flex items-center gap-3">
                    {/* Code Badge */}
                    <button
                        onClick={copyCode}
                        className="flex items-center gap-2 bg-(--theme-sidebar) rounded-xl corner-squircle px-3 py-2 hover:opacity-80 transition-opacity"
                    >
                        <span className="text-xs font-bold text-(--theme-text) opacity-50 uppercase">Code:</span>
                        <span className="text-sm md:text-base font-bold text-(--theme-text) tracking-[0.15em]">
                            {classroom.code}
                        </span>
                        {codeCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                        ) : (
                            <Copy className="h-4 w-4 text-(--theme-text) opacity-50" />
                        )}
                    </button>

                    {/* Notification Bell Dropdown */}
                    <DropdownMenu open={showDismissedAnnouncements} onOpenChange={setShowDismissedAnnouncements}>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-xl corner-squircle transition-colors relative outline-none",
                                    showDismissedAnnouncements ? "bg-(--theme-card) text-(--theme-text)" : "text-(--theme-text) hover:opacity-80 bg-(--theme-sidebar)"
                                )}
                                title="View Announcements"
                            >
                                <HugeiconsIcon icon={Notification01Icon} className="h-5 w-5" />
                                {dismissedAnnouncements.size > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                        {dismissedAnnouncements.size}
                                    </span>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[380px] p-0 border-(--theme-text)/10 bg-(--theme-bg) shadow-2xl rounded-xl corner-squircle">
                            <div className="p-4 border-b border-(--theme-text)/10">
                                <h3 className="font-bold text-(--theme-text) uppercase text-sm">Announcements</h3>
                            </div>
                            <ScrollArea className="h-[400px]">
                                <div className="p-4">
                                    <AnnouncementBanner
                                        classroomId={classroomId}
                                        isTeacher={isTeacher}
                                        dismissed={dismissedAnnouncements}
                                        setDismissed={setDismissedAnnouncements}
                                        showDismissed={true} // Always show all within the dropdown
                                    />
                                </div>
                            </ScrollArea>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Active Announcements Banner */}
            <div className="mb-6">
                <AnnouncementBanner
                    classroomId={classroomId}
                    isTeacher={isTeacher}
                    dismissed={dismissedAnnouncements}
                    setDismissed={setDismissedAnnouncements}
                    showDismissed={false}
                />
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                {TABS.map((tab) => {
                    // Only show Settings to teachers
                    if (tab === "Settings" && !isTeacher) return null;
                    return (
                        <FancyButton
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "text-xs md:text-base font-bold uppercase px-4 py-1.5 whitespace-nowrap",
                                activeTab === tab
                                    ? "bg-(--theme-card) text-(--theme-text)"
                                    : "text-(--theme-text) opacity-60"
                            )}
                        >
                            {tab}
                        </FancyButton>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === "Feed" && (
                <ClassroomFeed classroomId={classroomId} isTeacher={isTeacher} />
            )}
            {activeTab === "People" && (
                <ClassroomPeople classroomId={classroomId} isTeacher={isTeacher} />
            )}
            {activeTab === "Grades" && (
                <ClassroomGradebook classroomId={classroomId} isTeacher={isTeacher} />
            )}
            {activeTab === "Settings" && isTeacher && (
                <ClassroomSettings
                    classroom={classroom}
                    onUpdated={fetchClassroom}
                    onDeleted={() => router.push("/classroom")}
                />
            )}
        </div>
    );
}
