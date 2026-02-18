"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FancyButton } from "@/components/ui/fancybutton";
import { ClassroomCard } from "@/components/classroom/ClassroomCard";
import { CreateClassroomModal } from "@/components/classroom/CreateClassroomModal";
import { JoinClassroomModal } from "@/components/classroom/JoinClassroomModal";
import { Spinner } from "@/components/ui/spinner";
import { Plus, LogIn } from "lucide-react";

interface ClassroomData {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    color?: string | null;
    subject?: string | null;
    role: string;
    memberCount: number;
    creatorName?: string | null;
    createdAt: string;
}

export default function ClassroomPage() {
    const router = useRouter();
    const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);

    const fetchClassrooms = useCallback(async () => {
        try {
            const res = await fetch("/api/classrooms");
            if (!res.ok) return;
            const data = await res.json();
            setClassrooms(data);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClassrooms();
    }, [fetchClassrooms]);

    const handleCreated = (classroom: ClassroomData) => {
        setClassrooms((prev) => [classroom, ...prev]);
    };

    const handleJoined = (classroom: ClassroomData) => {
        setClassrooms((prev) => [classroom, ...prev]);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <h1 className="text-3xl md:text-5xl font-bold text-(--theme-text) uppercase tracking-tight">
                    My Classrooms
                </h1>
                <div className="flex gap-3">
                    <FancyButton
                        onClick={() => setJoinOpen(true)}
                        className="text-(--theme-text) text-xs md:text-base font-bold uppercase px-4 py-1.5"
                    >
                        <LogIn className="h-4 w-4 mr-2" />
                        Join
                    </FancyButton>
                    <FancyButton
                        onClick={() => setCreateOpen(true)}
                        className="text-(--theme-text) text-xs md:text-base font-bold uppercase px-4 py-1.5"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create
                    </FancyButton>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Spinner />
                </div>
            ) : classrooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-6xl mb-4">🏫</div>
                    <h2 className="text-xl md:text-2xl font-bold text-(--theme-text) uppercase mb-2">
                        No Classrooms Yet
                    </h2>
                    <p className="text-sm text-(--theme-text) opacity-60 max-w-md mb-6">
                        Create a new classroom to start teaching, or join an existing one with a code from your teacher.
                    </p>
                    <div className="flex gap-3">
                        <FancyButton
                            onClick={() => setJoinOpen(true)}
                            className="text-(--theme-text) text-sm font-bold uppercase px-4 py-1.5"
                        >
                            <LogIn className="h-4 w-4 mr-2" />
                            Join a Classroom
                        </FancyButton>
                        <FancyButton
                            onClick={() => setCreateOpen(true)}
                            className="text-(--theme-text) text-sm font-bold uppercase px-4 py-1.5"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create a Classroom
                        </FancyButton>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {classrooms.map((c) => (
                        <ClassroomCard
                            key={c.id}
                            {...c}
                            onClick={() => router.push(`/classroom/${c.id}`)}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            <CreateClassroomModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={handleCreated}
            />
            <JoinClassroomModal
                open={joinOpen}
                onClose={() => setJoinOpen(false)}
                onJoined={handleJoined}
            />
        </div>
    );
}
