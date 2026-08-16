"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClassroomCard } from "@/components/classroom/ClassroomCard";
import { CreateClassroomModal } from "@/components/classroom/CreateClassroomModal";
import { JoinClassroomModal } from "@/components/classroom/JoinClassroomModal";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { ListFilter, Plus, LogIn, Search } from "lucide-react";

type ClassroomTab = "joined" | "created";
type ClassroomRoleFilter = "all" | "TEACHER" | "TEACHING_ASSISTANT" | "STUDENT";

const TAB_KEY = "classrooms-active-tab";

const CLASSROOM_ROLE_OPTIONS = [
    { value: "all", label: "All roles", icon: ListFilter },
    { value: "TEACHER", label: "Teacher" },
    { value: "TEACHING_ASSISTANT", label: "Teaching assistant" },
    { value: "STUDENT", label: "Student" },
] satisfies Array<{ value: ClassroomRoleFilter; label: string; icon?: typeof ListFilter }>;

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
    isOwner: boolean;
}

export default function ClassroomPage() {
    const router = useRouter();
    const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ClassroomTab | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<ClassroomRoleFilter>("all");

    const fetchClassrooms = useCallback(async () => {
        try {
            const res = await fetch("/api/classrooms");
            if (!res.ok) return;
            const data = await res.json() as ClassroomData[];
            setClassrooms(data);
            setActiveTab((current) => {
                if (current) return current;
                const storedTab = window.localStorage.getItem(TAB_KEY);
                if (storedTab === "joined" || storedTab === "created") return storedTab;
                return data.some((classroom) => !classroom.isOwner) ? "joined" : "created";
            });
        } catch {
            // Keep the empty state when the request fails.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClassrooms();
    }, [fetchClassrooms]);

    const changeTab = (tab: ClassroomTab) => {
        setActiveTab(tab);
        window.localStorage.setItem(TAB_KEY, tab);
    };

    const visibleClassrooms = useMemo(() => {
        const query = search.trim().toLowerCase();
        return classrooms.filter((classroom) => {
            const matchesTab = activeTab === "created" ? classroom.isOwner : !classroom.isOwner;
            const matchesRole = roleFilter === "all" || classroom.role === roleFilter;
            const matchesSearch = !query || [classroom.name, classroom.subject, classroom.description, classroom.creatorName]
                .some((value) => value?.toLowerCase().includes(query));
            return matchesTab && matchesRole && matchesSearch;
        });
    }, [activeTab, classrooms, roleFilter, search]);

    const hasActiveFilters = Boolean(search.trim()) || roleFilter !== "all";

    return (
        <div className="classroom-ui min-h-full bg-[var(--classroom-canvas)]">
            <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-11 md:py-7">
                <header className="mb-5 flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--classroom-text)] md:text-[42px]">
                            Classrooms
                        </h1>
                    </div>
                    <WorkspaceButton type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4" /> New classroom
                    </WorkspaceButton>
                </header>

                <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-3 lg:flex-row lg:items-center lg:justify-between">
                    <WorkspaceTabs
                        ariaLabel="Classroom library"
                        value={activeTab ?? "joined"}
                        onValueChange={changeTab}
                        items={[{ value: "joined", label: "Joined" }, { value: "created", label: "Created" }] satisfies Array<{ value: ClassroomTab; label: string }>}
                        fill
                        className="sm:w-auto"
                    />

                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--classroom-text-faint)]" />
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search classrooms" aria-label="Search classrooms" className="h-9 w-full rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] pl-9 pr-3 text-sm text-[var(--classroom-text)] outline-none placeholder:text-[var(--classroom-text-faint)] focus:border-[var(--classroom-focus-border)] focus:ring-2 focus:ring-[var(--classroom-focus-ring)]" />
                        </label>
                        <WorkspaceSelect ariaLabel="Classroom role" value={roleFilter} options={CLASSROOM_ROLE_OPTIONS} onValueChange={setRoleFilter} />
                        <WorkspaceButton type="button" variant="secondary" onClick={() => setJoinOpen(true)}>
                            <LogIn className="h-4 w-4" /> Join classroom
                        </WorkspaceButton>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Spinner /></div>
                ) : visibleClassrooms.length === 0 ? (
                    <section className="flex flex-col items-center justify-center rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] px-6 py-16 text-center">
                        <h2 className="mb-2 text-xl font-semibold text-[var(--classroom-text)] md:text-2xl">{hasActiveFilters ? "No classrooms match these filters" : activeTab === "created" ? "No classrooms created yet" : "No joined classrooms yet"}</h2>
                        <p className="mb-6 max-w-md text-sm text-[var(--classroom-text-muted)]">
                            {hasActiveFilters ? "Try a different search or role." : activeTab === "created" ? "Create a classroom to start teaching." : "Join a classroom with a code from your teacher."}
                        </p>
                        {hasActiveFilters ? (
                            <WorkspaceButton type="button" variant="secondary" onClick={() => { setSearch(""); setRoleFilter("all"); }}>Clear filters</WorkspaceButton>
                        ) : activeTab === "created" ? (
                            <WorkspaceButton type="button" variant="primary" onClick={() => setCreateOpen(true)}>Create a classroom</WorkspaceButton>
                        ) : (
                            <WorkspaceButton type="button" variant="secondary" onClick={() => setJoinOpen(true)}>Join a classroom</WorkspaceButton>
                        )}
                    </section>
                ) : (
                    <section className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,350px))]" aria-label={activeTab === "created" ? "Classrooms you created" : "Classrooms you joined"}>
                        {visibleClassrooms.map((classroom) => (
                            <ClassroomCard key={classroom.id} {...classroom} onClick={() => router.push(`/classroom/${classroom.id}`)} />
                        ))}
                    </section>
                )}

                <CreateClassroomModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    onCreated={(classroom) => { setClassrooms((current) => [classroom, ...current]); changeTab("created"); }}
                />
                <JoinClassroomModal
                    open={joinOpen}
                    onClose={() => setJoinOpen(false)}
                    onJoined={(classroom) => { setClassrooms((current) => [classroom, ...current]); changeTab("joined"); }}
                />
            </div>
        </div>
    );
}
