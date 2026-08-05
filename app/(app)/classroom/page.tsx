"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ClassroomCard } from "@/components/classroom/ClassroomCard";
import { CreateClassroomModal } from "@/components/classroom/CreateClassroomModal";
import { JoinClassroomModal } from "@/components/classroom/JoinClassroomModal";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Plus, LogIn, School } from "lucide-react";

interface ClassroomData {
    id: string;
    name: string;
    description?: string | null;
    code: string;
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
            setClassrooms(await res.json());
        } catch {
            // Keep the empty state when the request fails.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClassrooms();
    }, [fetchClassrooms]);

    return (
        <div className="classroom-ui min-h-full bg-[var(--classroom-canvas)]">
            <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-11 md:py-7">
                <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--classroom-text)] md:text-[42px]">
                            Classrooms
                        </h1>
                    </div>
                    <div className="flex gap-3">
                        <WorkspaceButton type="button" variant="secondary" onClick={() => setJoinOpen(true)}>
                            <LogIn className="h-4 w-4" /> Join classroom
                        </WorkspaceButton>
                        <WorkspaceButton type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4" /> New classroom
                        </WorkspaceButton>
                    </div>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Spinner /></div>
                ) : classrooms.length === 0 ? (
                    <section className="flex flex-col items-center justify-center rounded-2xl border border-[var(--classroom-line)] bg-white px-6 py-16 text-center">
                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--classroom-role-teacher-bg)] text-[var(--classroom-role-teacher-text)]">
                            <School className="h-6 w-6" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-[var(--classroom-text)] md:text-2xl">No classrooms yet</h2>
                        <p className="mb-6 max-w-md text-sm text-[var(--classroom-text-muted)]">
                            Create a classroom to start teaching, or join one with a code from your teacher.
                        </p>
                        <div className="flex gap-3">
                            <WorkspaceButton type="button" variant="secondary" onClick={() => setJoinOpen(true)}>Join a classroom</WorkspaceButton>
                            <WorkspaceButton type="button" variant="primary" onClick={() => setCreateOpen(true)}>Create a classroom</WorkspaceButton>
                        </div>
                    </section>
                ) : (
                    <section className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,350px))]" aria-label="Your classrooms">
                        {classrooms.map((classroom) => (
                            <ClassroomCard key={classroom.id} {...classroom} onClick={() => router.push(`/classroom/${classroom.id}`)} />
                        ))}
                    </section>
                )}

                <CreateClassroomModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onCreated={(classroom) => setClassrooms((current) => [classroom, ...current])}
                />
                <JoinClassroomModal
                    open={joinOpen}
                    onClose={() => setJoinOpen(false)}
                    onJoined={(classroom) => setClassrooms((current) => [classroom, ...current])}
                />
            </div>
        </div>
    );
}
