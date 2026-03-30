import { useState, useRef } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PlusSignIcon, DragDropVerticalIcon, SquareLock02Icon } from "hugeicons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SparklesIcon, UploadIcon, XIcon, Loader2Icon, FileIcon } from "lucide-react";

interface CourseBuilderSidebarProps {
    course: any;
    onCourseChange: (course: any) => void;
    activeLessonId: string | null;
    onSelectLesson: (id: string) => void;
    isSaving?: boolean;
}

export default function CourseBuilderSidebar({ course, onCourseChange, activeLessonId, onSelectLesson, isSaving = false }: CourseBuilderSidebarProps) {
    const [isAIExpanded, setIsAIExpanded] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Very basic optimistic drag update for lessons within the same module
    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const sourceIndex = result.source.index;
        const destIndex = result.destination.index;
        const moduleId = result.source.droppableId;

        if (sourceIndex === destIndex) return;

        // Clone state
        const modules = [...course.modules];
        const moduleIndex = modules.findIndex((m: any) => m.id === moduleId);
        if (moduleIndex === -1) return;

        const originalLessons = [...modules[moduleIndex].lessons];
        const newLessons = Array.from(modules[moduleIndex].lessons);

        // Reorder array
        const [moved] = newLessons.splice(sourceIndex, 1);
        newLessons.splice(destIndex, 0, moved);

        // Update orders locally to match visual
        const updatedLessons = newLessons.map((l: any, i) => ({ ...l, order: i }));
        onCourseChange({
            modules: modules.map((m, i) => i === moduleIndex ? { ...m, lessons: updatedLessons } : m)
        });

        // Save to DB
        try {
            const res = await fetch(`/api/courses/${course.id}/lessons/reorder`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    list: updatedLessons.map((l: any) => ({ id: l.id, order: l.order, moduleId: moduleId }))
                })
            });
            if (!res.ok) throw new Error("Failed");
        } catch (e) {
            // Revert on fail
            toast.error("Failed to reorder lessons");
            onCourseChange({
                modules: course.modules.map((m: any, i: number) => i === moduleIndex ? { ...m, lessons: originalLessons } : m)
            });
        }
    };

    const addModule = async () => {
        const title = prompt("New Module Title:");
        if (!title) return;

        const res = await fetch(`/api/courses/${course.id}/modules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description: "" })
        });
        if (res.ok) {
            const newModule = await res.json();
            onCourseChange({ modules: [...course.modules, newModule] });
        }
    };

    const addLesson = async (moduleId: string) => {
        const title = prompt("New Lesson Title:");
        if (!title) return;

        const res = await fetch(`/api/courses/${course.id}/modules/${moduleId}/lessons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description: "", content: "" })
        });
        if (res.ok) {
            const newLesson = await res.json();
            onCourseChange({
                modules: course.modules.map((m: any) => {
                    if (m.id === moduleId) {
                        return { ...m, lessons: [...m.lessons, newLesson] };
                    }
                    return m;
                })
            });
            onSelectLesson(newLesson.id);
        }
    }

    const handleBulkGenerate = async () => {
        if (!selectedFile) {
            toast.error("Please select a file first");
            return;
        }
        setIsGenerating(true);
        const toastId = toast.loading("AI is analyzing your file and dreaming up a syllabus...");

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const generateRes = await fetch(`/api/courses/${course.id}/generate-from-file`, {
                method: "POST",
                body: formData,
            });

            if (!generateRes.ok) {
                const err = await generateRes.json();
                throw new Error(err.error || "Outline generation failed");
            }

            const { outline } = await generateRes.json();

            // Now we need to create these modules and lessons in the DB
            // We'll do it sequentially to keep it simple and avoid race conditions with order
            const createdModules = [];
            for (const mod of outline.modules) {
                const modRes = await fetch(`/api/courses/${course.id}/modules`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: mod.title, description: mod.description })
                });
                if (!modRes.ok) continue;
                const newModule = await modRes.json();

                const createdLessons = [];
                for (const les of mod.lessons) {
                    const lesRes = await fetch(`/api/courses/${course.id}/modules/${newModule.id}/lessons`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: les.title, description: les.description, content: "" })
                    });
                    if (lesRes.ok) {
                        createdLessons.push(await lesRes.json());
                    }
                }
                createdModules.push({ ...newModule, lessons: createdLessons });
            }

            onCourseChange({ modules: [...course.modules, ...createdModules] });
            toast.success("Syllabus generated from file!", { id: toastId });
            setIsAIExpanded(false);
            setSelectedFile(null);
        } catch (e: any) {
            toast.error(e.message || "Failed to generate syllabus", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    const togglePrerequisite = async (lesson: any, moduleId: string) => {
        // ... (same as before)
        const isLocked = !lesson.isLocked;

        try {
            const res = await fetch(`/api/courses/${course.id}/modules/${moduleId}/lessons/${lesson.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isLocked })
            });

            if (res.ok) {
                onCourseChange({
                    modules: course.modules.map((m: any) => {
                        if (m.id === moduleId) {
                            return {
                                ...m,
                                lessons: m.lessons.map((l: any) => l.id === lesson.id ? { ...l, isLocked } : l)
                            };
                        }
                        return m;
                    })
                });
                toast.success(isLocked ? "Lesson set as prerequisite (blocks all subsequent)" : "Prerequisite removed");
            }
        } catch (e) {
            toast.error("Failed to update prerequisite");
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 border-r overflow-hidden">
            <div className="p-4 border-b shrink-0 bg-white">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-xs uppercase tracking-widest text-slate-400">Syllabus</h2>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 transition-colors ${isAIExpanded ? 'text-amber-500 bg-amber-50' : 'text-slate-400'} ${isSaving ? 'cursor-not-allowed opacity-50' : ''}`}
                            onClick={() => !isSaving && setIsAIExpanded(!isAIExpanded)}
                            disabled={isSaving}
                            title="Generate Outline with AI"
                        >
                            <SparklesIcon className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 text-slate-400 ${isSaving ? 'cursor-not-allowed opacity-50' : ''}`} onClick={addModule} disabled={isSaving}>
                            <PlusSignIcon className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {isAIExpanded && (
                    <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-lg p-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-bold text-amber-800/60 uppercase tracking-tighter">AI Course Outline Generator</p>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                accept=".pdf,.doc,.docx,image/*"
                            />

                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-dashed border-amber-300 bg-white hover:bg-amber-50 text-amber-700 text-[11px] h-8 justify-start gap-2"
                                >
                                    <UploadIcon className="w-3 h-3" />
                                    {selectedFile ? (
                                        <span className="truncate">{selectedFile.name}</span>
                                    ) : "Upload Source File"}
                                </Button>

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={handleBulkGenerate}
                                        disabled={isGenerating || !selectedFile}
                                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-8 gap-2 shadow-sm"
                                    >
                                        {isGenerating ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                                        {isGenerating ? "Processing..." : "Generate"}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => { setIsAIExpanded(false); setSelectedFile(null); }}
                                        className="h-8 w-8 p-0 text-slate-400"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <DragDropContext onDragEnd={handleDragEnd}>
                    {course.modules.map((module: any) => (
                        <div key={module.id} className="space-y-2">
                            <div className="flex items-center justify-between group">
                                <h3 className="font-medium text-slate-800 text-sm">
                                    {module.title}
                                </h3>
                                <Button variant="ghost" size="icon" className={`h-6 w-6 opacity-0 group-hover:opacity-100 ${isSaving ? 'cursor-not-allowed' : ''}`} onClick={() => !isSaving && addLesson(module.id)} disabled={isSaving}>
                                    <PlusSignIcon className="w-3 h-3 text-slate-500" />
                                </Button>
                            </div>

                            <Droppable droppableId={module.id}>
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-1 pl-2 border-l-2 border-slate-200 ml-1 py-1"
                                    >
                                        {module.lessons.map((lesson: any, index: number) => (
                                            <Draggable key={lesson.id} draggableId={lesson.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`flex items-center gap-2 pr-2 py-1 rounded-md text-sm transition-colors group/lesson ${activeLessonId === lesson.id
                                                            ? "bg-primary/10 text-primary font-medium"
                                                            : "hover:bg-slate-200/50 text-slate-600"
                                                            } ${snapshot.isDragging ? "shadow-md bg-white border z-50" : ""}`}
                                                    >
                                                        <div {...provided.dragHandleProps} className="opacity-40 hover:opacity-100 p-1 cursor-grab">
                                                            <DragDropVerticalIcon className="w-3 h-3" />
                                                        </div>
                                                        <div
                                                            className={`flex-1 truncate py-1 ${isSaving ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer'}`}
                                                            onClick={() => !isSaving && onSelectLesson(lesson.id)}
                                                        >
                                                            {lesson.title}
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                togglePrerequisite(lesson, module.id);
                                                            }}
                                                            className={`p-1 rounded opacity-0 group-hover/lesson:opacity-100 transition-opacity ${lesson.isLocked ? 'text-amber-500 opacity-100' : 'text-slate-400 hover:text-amber-500'}`}
                                                            title={lesson.isLocked ? "Remove prerequisite" : "Set as prerequisite (blocks all subsequent)"}
                                                        >
                                                            <SquareLock02Icon className="w-3.5 h-3.5" />
                                                        </button>

                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </DragDropContext>
            </div>
        </div>
    );
}
