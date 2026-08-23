"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { isLocalDateTimePast, minimumLocalDateTimeInputValue } from "@/lib/schedule-validation";

type TestDetails = { title: string; opensAt?: string | null; closesAt?: string | null; maxAttempts: number };

function toLocalInput(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TestScheduleControls({ classroomId, testId, onDeleted }: { classroomId: string; testId: string; onDeleted: () => void }) {
    const [title, setTitle] = useState("");
    const [opensAt, setOpensAt] = useState("");
    const [closesAt, setClosesAt] = useState("");
    const [originalSchedule, setOriginalSchedule] = useState({ opensAt: "", closesAt: "" });
    const [maxAttempts, setMaxAttempts] = useState("1");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`/api/classrooms/${classroomId}/tests/${testId}`)
            .then((res) => res.ok ? res.json() : null)
            .then((test: TestDetails | null) => {
                if (!test) return;
                setTitle(test.title);
                const nextOpensAt = toLocalInput(test.opensAt);
                const nextClosesAt = toLocalInput(test.closesAt);
                setOpensAt(nextOpensAt);
                setClosesAt(nextClosesAt);
                setOriginalSchedule({ opensAt: nextOpensAt, closesAt: nextClosesAt });
                setMaxAttempts(String(test.maxAttempts ?? 1));
            });
    }, [classroomId, testId]);

    const save = async () => {
        if (!title.trim()) return toast.error("Title is required.");
        if (opensAt && opensAt !== originalSchedule.opensAt && isLocalDateTimePast(opensAt)) return toast.error("Opening time cannot be in the past.");
        if (closesAt && closesAt !== originalSchedule.closesAt && isLocalDateTimePast(closesAt)) return toast.error("Closing time cannot be in the past.");
        if (opensAt && closesAt && new Date(closesAt) < new Date(opensAt)) return toast.error("Closing time must be after opening time.");
        if (!Number.isSafeInteger(Number(maxAttempts)) || Number(maxAttempts) < 1) return toast.error("Attempts allowed must be a positive integer.");
        setSaving(true);
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/tests/${testId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    opensAt: opensAt ? new Date(opensAt).toISOString() : null,
                    closesAt: closesAt ? new Date(closesAt).toISOString() : null,
                    maxAttempts: Number(maxAttempts),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toast.error(data.error ?? "Could not update the test.");
            setOriginalSchedule({ opensAt, closesAt });
            toast.success("Test and calendars updated.");
        } finally {
            setSaving(false);
        }
    };

    const handleOpensAtChange = (nextOpensAt: string) => {
        if (nextOpensAt && nextOpensAt !== originalSchedule.opensAt && isLocalDateTimePast(nextOpensAt)) return;
        setOpensAt(nextOpensAt);
        if (nextOpensAt && closesAt && closesAt < nextOpensAt) setClosesAt("");
    };

    const handleClosesAtChange = (nextClosesAt: string) => {
        if (nextClosesAt && nextClosesAt !== originalSchedule.closesAt && isLocalDateTimePast(nextClosesAt)) return;
        if (nextClosesAt && opensAt && nextClosesAt < opensAt) return;
        setClosesAt(nextClosesAt);
    };

    const remove = async () => {
        if (!window.confirm("Remove this test and its calendar event?")) return;
        const res = await fetch(`/api/classrooms/${classroomId}/tests/${testId}`, { method: "DELETE" });
        if (!res.ok) return toast.error("Could not remove the test.");
        toast.success("Test removed.");
        onDeleted();
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-4 shadow-none">
            <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="h-4 w-4" />
                <h3 className="text-sm font-bold uppercase text-(--theme-text)">Schedule & sync</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_150px_190px_190px_auto] gap-2 items-end">
                <div><label className="text-[10px] font-bold uppercase opacity-50">Title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-(--theme-sidebar) border-0 h-10" /></div>
                <div><label className="text-[10px] font-bold uppercase opacity-50">Attempts allowed</label><Input type="number" min="1" step="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} className="bg-(--theme-sidebar) border-0 h-10" /></div>
                <div><label className="text-[10px] font-bold uppercase opacity-50">Opens</label><Input type="datetime-local" min={minimumLocalDateTimeInputValue()} value={opensAt} onChange={(e) => handleOpensAtChange(e.target.value)} className="bg-(--theme-sidebar) border-0 h-10" /></div>
                <div><label className="text-[10px] font-bold uppercase opacity-50">Closes</label><Input type="datetime-local" min={opensAt && opensAt > minimumLocalDateTimeInputValue() ? opensAt : minimumLocalDateTimeInputValue()} value={closesAt} onChange={(e) => handleClosesAtChange(e.target.value)} className="bg-(--theme-sidebar) border-0 h-10" /></div>
                <div className="flex gap-2">
                    <WorkspaceButton type="button" variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</WorkspaceButton>
                    <WorkspaceButton type="button" variant="danger" size="icon" onClick={remove} aria-label="Delete test"><Trash2 className="h-4 w-4" /></WorkspaceButton>
                </div>
            </div>
        </div>
    );
}
