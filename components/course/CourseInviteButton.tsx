"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

type Grant = { id: string; user: { id: string; name: string; email: string } };

export function CourseInviteButton({ courseId }: { courseId: string }) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [grants, setGrants] = useState<Grant[]>([]);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const res = await fetch(`/api/courses/${courseId}/access`);
        if (res.ok) setGrants(await res.json());
    }, [courseId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const invite = async () => {
        if (!email.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/access`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toast.error(data.error ?? "Could not send the invitation.");
            toast.success("Course access granted.");
            setEmail("");
            load();
        } finally { setSaving(false); }
    };

    const revoke = async (userId: string) => {
        const res = await fetch(`/api/courses/${courseId}/access?userId=${userId}`, { method: "DELETE" });
        if (res.ok) setGrants((current) => current.filter((grant) => grant.user.id !== userId));
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-8 text-xs font-bold">
                <Mail className="h-3.5 w-3.5 mr-2" /> Invite
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md bg-white rounded-2xl">
                    <DialogHeader><DialogTitle>Course invitations</DialogTitle></DialogHeader>
                    <div className="flex gap-2 mt-2">
                        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") invite(); }} placeholder="student@example.com" />
                        <Button onClick={invite} disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto mt-3">
                        {grants.length === 0 ? <p className="text-sm text-slate-500 py-5 text-center">No one has been invited yet.</p> : grants.map((grant) => (
                            <div key={grant.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                                <div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{grant.user.name}</p><p className="text-xs text-slate-500 truncate">{grant.user.email}</p></div>
                                <button onClick={() => revoke(grant.user.id)} aria-label={`Remove ${grant.user.name}`} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

