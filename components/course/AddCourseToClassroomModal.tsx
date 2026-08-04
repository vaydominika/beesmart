"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type CourseSource = "my" | "all";
type Course = { id: string; title: string; description?: string | null; visibility: string; creator: { name: string }; _count?: { modules: number } };
type Classroom = { id: string; name: string; role: string };

export function AddCourseToClassroomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [source, setSource] = useState<CourseSource>("my");
    const [search, setSearch] = useState("");
    const [courses, setCourses] = useState<Course[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [courseId, setCourseId] = useState("");
    const [classroomId, setClassroomId] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        fetch("/api/classrooms")
            .then((res) => res.ok ? res.json() : [])
            .then((data: Classroom[]) => {
                const teachable = data.filter((classroom) => classroom.role !== "STUDENT");
                setClassrooms(teachable);
                setClassroomId((current) => current || teachable[0]?.id || "");
            });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ source });
                if (search.trim()) params.set("search", search.trim());
                const res = await fetch(`/api/courses?${params}`);
                setCourses(res.ok ? await res.json() : []);
            } finally {
                setLoading(false);
            }
        }, 200);
        return () => window.clearTimeout(timer);
    }, [open, search, source]);

    const addCourse = async () => {
        if (!courseId || !classroomId) {
            toast.error("Select a course and Classroom.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/courses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error ?? "Could not add the course.");
                return;
            }
            toast.success("Course added to Classroom.");
            setCourseId("");
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-2xl max-h-[90vh] overflow-hidden border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8">
                    <DialogHeader>
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">Add to Classroom</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-(--theme-text) block mb-1">Destination Classroom</label>
                            <select
                                value={classroomId}
                                onChange={(event) => setClassroomId(event.target.value)}
                                className="w-full h-11 px-3 bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold text-(--theme-text) border-0 outline-none"
                            >
                                {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
                            </select>
                            {classrooms.length === 0 && <p className="text-xs text-(--theme-text) opacity-50 mt-1">Create or join a Classroom as a teacher first.</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-1 bg-(--theme-sidebar) p-1 rounded-xl">
                            {(["my", "all"] as CourseSource[]).map((tab) => (
                                <button key={tab} onClick={() => { setSource(tab); setCourseId(""); }} className={cn(
                                    "py-2 rounded-lg text-xs font-bold uppercase transition-colors",
                                    source === tab ? "bg-(--theme-card)" : "opacity-45 hover:opacity-80",
                                )}>
                                    {tab === "my" ? "My Courses" : "All Available Courses"}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-35" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, description, or creator" className="pl-10 h-11 bg-(--theme-sidebar) border-0 rounded-xl" />
                        </div>

                        <div className="h-64 overflow-y-auto space-y-2 pr-1">
                            {loading ? <div className="h-full flex items-center justify-center"><Spinner /></div> : courses.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs font-bold uppercase text-(--theme-text) opacity-35">No matching courses</div>
                            ) : courses.map((course) => (
                                <button
                                    key={course.id}
                                    onClick={() => setCourseId(course.id)}
                                    disabled={course.visibility === "PRIVATE"}
                                    title={course.visibility === "PRIVATE" ? "Change this course to Public or Invitation-only before assigning it" : undefined}
                                    className={cn("w-full flex gap-3 items-center text-left p-3 rounded-xl transition-colors", courseId === course.id ? "bg-(--theme-card)" : "bg-(--theme-sidebar) hover:opacity-80", course.visibility === "PRIVATE" && "opacity-35 cursor-not-allowed")}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-(--theme-bg) flex items-center justify-center shrink-0"><BookOpen className="h-4 w-4" /></div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-(--theme-text) truncate">{course.title}</p>
                                        <p className="text-[10px] text-(--theme-text) opacity-45 uppercase truncate">{course.creator.name} · {course._count?.modules ?? 0} modules · {course.visibility.replace("_", " ")}</p>
                                    </div>
                                    {courseId === course.id && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <FancyButton onClick={onClose} className="flex-1 text-(--theme-text) text-xs md:text-lg font-bold uppercase">Cancel</FancyButton>
                            <FancyButton onClick={addCourse} disabled={saving || !courseId || !classroomId} className="flex-1 text-(--theme-text) text-xs md:text-lg font-bold uppercase">
                                {saving ? "Adding…" : "Add Course"}
                            </FancyButton>
                        </div>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
