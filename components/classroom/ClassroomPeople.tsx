"use client";

import { useState, useEffect, useCallback } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { UserCircle, Crown, Shield, MoreVertical, Trash2, ArrowUpDown } from "lucide-react";

interface Member {
    id: string;
    role: string;
    joinedAt: string;
    user: {
        id: string;
        name: string;
        email: string;
        avatar?: string | null;
    };
}

interface Props {
    classroomId: string;
    isTeacher: boolean;
}

export function ClassroomPeople({ classroomId, isTeacher }: Props) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [showQR, setShowQR] = useState(false);
    const [classroomCode, setClassroomCode] = useState("");
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    const fetchMembers = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`);
            if (!res.ok) return;
            setMembers(await res.json());
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [classroomId]);

    const fetchClassroom = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}`);
            if (!res.ok) return;
            const data = await res.json();
            setClassroomCode(data.code);
        } catch {
            // ignore
        }
    }, [classroomId]);

    useEffect(() => {
        fetchMembers();
        fetchClassroom();
    }, [fetchMembers, fetchClassroom]);

    const handleChangeRole = async (memberId: string, newRole: string) => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId, role: newRole }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to change role.");
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
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to remove member.");
                return;
            }
            toast.success("Member removed.");
            fetchMembers();
        } catch {
            toast.error("Failed to remove member.");
        }
        setMenuOpen(null);
    };

    const getRoleIcon = (role: string) => {
        if (role === "TEACHER") return <Crown className="h-4 w-4 text-amber-500" />;
        if (role === "TA") return <Shield className="h-4 w-4 text-purple-500" />;
        return <UserCircle className="h-4 w-4 text-(--theme-text) opacity-40" />;
    };

    const getRoleBadge = (role: string) => {
        if (role === "TEACHER") return "bg-amber-500/20 text-amber-600";
        if (role === "TA") return "bg-purple-500/20 text-purple-600";
        return "bg-blue-500/20 text-blue-600";
    };

    const teachers = members.filter((m) => m.role === "TEACHER" || m.role === "TA");
    const students = members.filter((m) => m.role === "STUDENT");
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/classroom/join?code=${classroomCode}` : "";

    if (loading) {
        return <div className="flex justify-center py-10"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            {/* QR Code Invite */}
            {isTeacher && (
                <FancyCard className="bg-(--theme-card) p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-(--theme-text) uppercase">Invite Students</h3>
                            <p className="text-xs text-(--theme-text) opacity-50 mt-0.5">
                                Share the code <span className="font-bold tracking-widest">{classroomCode}</span> or show the QR code
                            </p>
                        </div>
                        <FancyButton
                            onClick={() => setShowQR(!showQR)}
                            className="text-(--theme-text) text-xs font-bold uppercase px-3"
                        >
                            {showQR ? "Hide QR" : "Show QR"}
                        </FancyButton>
                    </div>
                    {showQR && joinUrl && (
                        <div className="mt-4 flex flex-col items-center">
                            <div className="bg-white p-4 rounded-xl">
                                <QRCodeSVG value={joinUrl} size={180} level="M" />
                            </div>
                            <p className="text-xs text-(--theme-text) opacity-40 mt-2">Scan to join classroom</p>
                        </div>
                    )}
                </FancyCard>
            )}

            {/* Teachers */}
            <div>
                <h3 className="text-xs font-bold text-(--theme-text) uppercase mb-3 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    Teachers ({teachers.length})
                </h3>
                <div className="space-y-2">
                    {teachers.map((m) => (
                        <FancyCard key={m.id} className="bg-(--theme-card) p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-(--theme-sidebar) flex items-center justify-center text-sm font-bold text-(--theme-text)">
                                        {m.user.name?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-(--theme-text)">{m.user.name}</span>
                                            <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md", getRoleBadge(m.role))}>
                                                {m.role}
                                            </span>
                                        </div>
                                        <span className="text-xs text-(--theme-text) opacity-40">{m.user.email}</span>
                                    </div>
                                </div>
                            </div>
                        </FancyCard>
                    ))}
                </div>
            </div>

            {/* Students */}
            <div>
                <h3 className="text-xs font-bold text-(--theme-text) uppercase mb-3 flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-blue-500" />
                    Students ({students.length})
                </h3>
                {students.length === 0 ? (
                    <p className="text-sm text-(--theme-text) opacity-40 py-4 text-center">No students yet.</p>
                ) : (
                    <div className="space-y-2">
                        {students.map((m) => (
                            <FancyCard key={m.id} className="bg-(--theme-card) p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-(--theme-sidebar) flex items-center justify-center text-sm font-bold text-(--theme-text)">
                                            {m.user.name?.[0]?.toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-(--theme-text)">{m.user.name}</span>
                                            <br />
                                            <span className="text-xs text-(--theme-text) opacity-40">{m.user.email}</span>
                                        </div>
                                    </div>
                                    {isTeacher && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                                                className="p-2 text-(--theme-text) opacity-40 hover:opacity-100 rounded-lg hover:bg-(--theme-sidebar)"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                            {menuOpen === m.id && (
                                                <div className="absolute right-0 top-full mt-1 bg-(--theme-bg) border border-(--theme-text)/10 rounded-xl corner-squircle shadow-lg z-10 min-w-[150px] py-1">
                                                    <button
                                                        onClick={() => handleChangeRole(m.id, "TA")}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-(--theme-text) hover:bg-(--theme-sidebar) flex items-center gap-2"
                                                    >
                                                        <ArrowUpDown className="h-3 w-3" />
                                                        Make TA
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemove(m.id)}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </FancyCard>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
