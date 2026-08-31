"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    Dialog,
    DialogClose,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceDialogContent } from "@/components/ui/workspace-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Crown, MoreVertical, Trash2, UserCircle, UserPlus, X } from "lucide-react";

type ClassroomRole = "TEACHER" | "TEACHING_ASSISTANT" | "STUDENT";

interface Member {
    id: string;
    role: ClassroomRole;
    joinedAt: string;
    isOwner: boolean;
    isCurrentUser: boolean;
    user: { id: string; name: string; email: string; avatar?: string | null };
}

interface Props {
    classroomId: string;
    isTeacher: boolean;
}

const ROLE_OPTIONS: Array<{ value: ClassroomRole; label: string }> = [
    { value: "TEACHER", label: "Teacher" },
    { value: "TEACHING_ASSISTANT", label: "Teaching assistant" },
    { value: "STUDENT", label: "Student" },
];

const roleLabel = (role: ClassroomRole) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

export function ClassroomPeople({ classroomId, isTeacher }: Props) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [memberEmail, setMemberEmail] = useState("");
    const [memberRole, setMemberRole] = useState<ClassroomRole>("TEACHER");
    const [addingMember, setAddingMember] = useState(false);

    const fetchPeople = useCallback(async () => {
        try {
            const membersResponse = await fetch(`/api/classrooms/${classroomId}/members`);
            if (membersResponse.ok) setMembers(await membersResponse.json());
        } catch {
            // Keep the existing lists if refreshing fails.
        } finally {
            setLoading(false);
        }
    }, [classroomId]);

    useEffect(() => {
        fetchPeople();
    }, [fetchPeople]);

    const handleChangeRole = async (memberId: string, role: ClassroomRole) => {
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId, role }),
            });
            if (!response.ok) {
                toast.error((await response.json().catch(() => ({}))).error || "Failed to change role.");
                return;
            }
            toast.success("Role updated.");
            await fetchPeople();
        } catch {
            toast.error("Failed to change role.");
        } finally {
            setMenuOpen(null);
        }
    };

    const handleRemove = async (memberId: string) => {
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId }),
            });
            if (!response.ok) {
                toast.error((await response.json().catch(() => ({}))).error || "Failed to remove member.");
                return;
            }
            toast.success("Member removed.");
            await fetchPeople();
        } catch {
            toast.error("Failed to remove member.");
        } finally {
            setMenuOpen(null);
        }
    };

    const handleAddMember = async () => {
        if (!memberEmail.trim()) return;
        setAddingMember(true);
        try {
            const response = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: memberEmail, role: memberRole }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error(result.error || "Could not add this teacher.");
                return;
            }

            toast.success(`${roleLabel(memberRole)} added.`);
            setMemberEmail("");
            setMemberRole("TEACHER");
            setAddMemberOpen(false);
            await fetchPeople();
        } catch {
            toast.error("Could not add this teacher.");
        } finally {
            setAddingMember(false);
        }
    };

    const teachers = members.filter((member) => member.role !== "STUDENT");
    const students = members.filter((member) => member.role === "STUDENT");

    if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

    const memberRow = (member: Member) => {
        const canManage = isTeacher && !member.isOwner && !member.isCurrentUser;

        return (
            <div key={member.id} className="flex items-center justify-between rounded-xl border border-(--classroom-line) bg-(--classroom-surface) p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--classroom-surface-muted) text-sm font-semibold text-(--classroom-text-muted)">
                        {member.user.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/profile/${member.user.id}`} className="truncate text-sm font-semibold text-(--classroom-text) hover:underline">{member.user.name}</Link>
                            <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                member.role === "TEACHER"
                                    ? "bg-(--classroom-accent) text-(--classroom-text)"
                                    : member.role === "TEACHING_ASSISTANT"
                                        ? "bg-(--classroom-surface-muted) text-(--classroom-text-muted)"
                                        : "border border-(--classroom-line) bg-(--classroom-surface) text-(--classroom-text-muted)",
                            )}>
                                {member.isOwner ? "Owner" : roleLabel(member.role)}
                            </span>
                        </div>
                        <p className="truncate text-xs text-(--classroom-text-muted)">{member.user.email}</p>
                    </div>
                </div>

                {canManage && (
                    <DropdownMenu open={menuOpen === member.id} onOpenChange={(open) => setMenuOpen(open ? member.id : null)}>
                        <DropdownMenuTrigger asChild>
                            <WorkspaceButton
                                type="button"
                                variant="ghost"
                                size="icon-compact"
                                aria-label={`Manage ${member.user.name}`}
                            >
                                <MoreVertical className="h-4 w-4" />
                            </WorkspaceButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} className="min-w-[180px] rounded-xl border-(--classroom-line-strong) bg-(--classroom-surface) p-1 shadow-lg">
                                {ROLE_OPTIONS.filter((option) => option.value !== member.role).map((option) => (
                                    <DropdownMenuItem
                                        key={option.value}
                                        onSelect={() => void handleChangeRole(member.id, option.value)}
                                        className="rounded-lg px-3 py-2 text-xs font-medium text-(--classroom-text-muted) focus:bg-(--classroom-surface-muted) focus:text-(--classroom-text)"
                                    >
                                        Make {option.label.toLowerCase()}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator className="bg-(--classroom-line)" />
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => void handleRemove(member.id)}
                                    className="rounded-lg px-3 py-2 text-xs font-medium text-(--classroom-danger) focus:bg-(--classroom-danger-soft)"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Remove
                                </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-(--classroom-text)">
                        <Crown className="h-4 w-4 text-(--classroom-focus-border)" />
                        Teachers <span className="font-normal text-(--classroom-text-muted)">{teachers.length}</span>
                    </h2>
                    {isTeacher && (
                        <WorkspaceButton type="button" variant="secondary" onClick={() => setAddMemberOpen(true)}>
                            <UserPlus className="h-4 w-4" /> Add teacher
                        </WorkspaceButton>
                    )}
                </div>
                <div className="space-y-2">{teachers.map(memberRow)}</div>
            </section>

            <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-(--classroom-text)">
                    <UserCircle className="h-4 w-4 text-(--classroom-text-muted)" />
                    Students <span className="font-normal text-(--classroom-text-muted)">{students.length}</span>
                </h2>
                {students.length === 0
                    ? <div className="rounded-xl border border-(--classroom-line) bg-(--classroom-surface) py-10 text-center text-sm text-(--classroom-text-muted)">No students have joined yet.</div>
                    : <div className="space-y-2">{students.map(memberRow)}</div>}
            </section>

            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <WorkspaceDialogContent mobileSheet={false} className="classroom-dialog w-[calc(100%-1.5rem)] max-w-md gap-0 rounded-2xl border border-(--classroom-line-strong) bg-(--classroom-surface) p-5 shadow-2xl">
                    <DialogClose asChild>
                        <WorkspaceButton type="button" variant="ghost" size="icon-compact" aria-label="Close add teacher dialog" className="absolute right-4 top-4">
                            <X className="h-4 w-4" />
                        </WorkspaceButton>
                    </DialogClose>
                    <DialogHeader className="border-b border-(--classroom-line) pb-4 pr-10 text-left">
                        <DialogTitle className="text-xl font-semibold text-(--classroom-text)">Add a teacher</DialogTitle>
                        <DialogDescription className="sr-only">Add an existing registered user to this classroom.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div>
                            <label htmlFor="teacher-email" className="mb-1.5 block text-xs font-medium text-(--classroom-text-muted)">Email</label>
                            <Input
                                id="teacher-email"
                                type="email"
                                value={memberEmail}
                                onChange={(event) => setMemberEmail(event.target.value)}
                                onKeyDown={(event) => { if (event.key === "Enter") handleAddMember(); }}
                                placeholder="teacher@example.com"
                                className="h-10 rounded-xl px-3 text-sm font-normal shadow-none"
                            />
                        </div>
                        <div>
                            <label htmlFor="teacher-role" className="mb-1.5 block text-xs font-medium text-(--classroom-text-muted)">Role</label>
                            <WorkspaceSelect
                                id="teacher-role"
                                value={memberRole}
                                onValueChange={setMemberRole}
                                ariaLabel="Teacher role"
                                options={[
                                    { value: "TEACHER", label: "Teacher" },
                                    { value: "TEACHING_ASSISTANT", label: "Teaching assistant" },
                                ] satisfies Array<{ value: ClassroomRole; label: string }>}
                                className="h-10 w-full"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-(--classroom-line) pt-3">
                        <WorkspaceButton type="button" variant="secondary" onClick={() => setAddMemberOpen(false)}>
                            Cancel
                        </WorkspaceButton>
                        <WorkspaceButton type="button" variant="primary" onClick={handleAddMember} disabled={addingMember || !memberEmail.trim()}>
                            {addingMember ? "Adding..." : "Add teacher"}
                        </WorkspaceButton>
                    </div>
                </WorkspaceDialogContent>
            </Dialog>
        </div>
    );
}
