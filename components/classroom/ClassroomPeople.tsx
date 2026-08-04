"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Crown, MoreVertical, Trash2, UserCircle } from "lucide-react";

interface Member {
    id: string;
    role: string;
    joinedAt: string;
    user: { id: string; name: string; email: string; avatar?: string | null };
}

interface Props {
    classroomId: string;
    isTeacher: boolean;
}

export function ClassroomPeople({ classroomId, isTeacher }: Props) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    const fetchMembers = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`);
            if (res.ok) setMembers(await res.json());
        } catch {
            // Keep the existing member list if the request fails.
        } finally {
            setLoading(false);
        }
    }, [classroomId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const handleChangeRole = async (memberId: string, newRole: string) => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId, role: newRole }),
            });
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error || "Failed to change role.");
                return;
            }
            toast.success("Role updated.");
            fetchMembers();
        } catch {
            toast.error("Failed to change role.");
        }
        setMenuOpen(null);
    };

    const handleRemove = async (memberId: string) => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId }),
            });
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error || "Failed to remove member.");
                return;
            }
            toast.success("Member removed.");
            fetchMembers();
        } catch {
            toast.error("Failed to remove member.");
        }
        setMenuOpen(null);
    };

    const teachers = members.filter((member) => member.role !== "STUDENT");
    const students = members.filter((member) => member.role === "STUDENT");
    const roleBadge = (role: string) => role === "TEACHER"
        ? "bg-[#fff4bd] text-[#755f00]"
        : role === "TEACHING_ASSISTANT"
            ? "bg-violet-50 text-violet-700"
            : "bg-sky-50 text-sky-700";

    if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

    const memberRow = (member: Member, canManage = false) => (
        <div key={member.id} className="flex items-center justify-between rounded-xl border border-[#e1e1da] bg-white p-3.5">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f1ec] text-sm font-semibold text-[#4f534d]">
                    {member.user.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[#20231f]">{member.user.name}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", roleBadge(member.role))}>
                            {member.role.replace("_", " ").toLowerCase()}
                        </span>
                    </div>
                    <p className="truncate text-xs text-[#848780]">{member.user.email}</p>
                </div>
            </div>
            {canManage && (
                <div className="relative">
                    <button
                        type="button"
                        aria-label={`Manage ${member.user.name}`}
                        onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                        className="rounded-lg p-2 text-[#7b7e78] transition-colors hover:bg-[#f3f3ef] hover:text-[#20231f]"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen === member.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-xl border border-[#deded7] bg-white py-1 shadow-lg">
                            <button onClick={() => handleChangeRole(member.id, "TEACHING_ASSISTANT")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#4f534d] hover:bg-[#f5f5f1]">
                                <ArrowUpDown className="h-3.5 w-3.5" /> Make teaching assistant
                            </button>
                            <button onClick={() => handleRemove(member.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#20231f]"><Crown className="h-4 w-4 text-[#b28c00]" /> Teachers <span className="font-normal text-[#8a8d87]">{teachers.length}</span></h2>
                <div className="space-y-2">{teachers.map((member) => memberRow(member))}</div>
            </section>

            <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#20231f]"><UserCircle className="h-4 w-4 text-[#6e726b]" /> Students <span className="font-normal text-[#8a8d87]">{students.length}</span></h2>
                {students.length === 0
                    ? <div className="rounded-xl border border-[#deded7] bg-white py-10 text-center text-sm text-[#848780]">No students have joined yet.</div>
                    : <div className="space-y-2">{students.map((member) => memberRow(member, isTeacher))}</div>}
            </section>
        </div>
    );
}
