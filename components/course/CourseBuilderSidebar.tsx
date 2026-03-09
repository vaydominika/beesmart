"use client";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { PlusSignIcon, DragDropVerticalIcon, LockPasswordIcon } from "hugeicons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CourseBuilderSidebarProps {
    course: any;
    onCourseChange: (course: any) => void;
    activeLessonId: string | null;
    onSelectLesson: (id: string) => void;
}

export default function CourseBuilderSidebar({ course, onCourseChange, activeLessonId, onSelectLesson }: CourseBuilderSidebarProps) {

    // Very basic optimistic drag update for lessons within the same module
    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const sourceIndex = result.source.index;
        const destIndex = result.destination.index;
        const moduleId = result.source.droppableId;

        if (sourceIndex === destIndex) return;

        // Clone state
        const modules = [...course.modules];
        const moduleIndex = modules.findIndex(m => m.id === moduleId);
        if (moduleIndex === -1) return;

        const originalLessons = [...modules[moduleIndex].lessons];
        const newLessons = Array.from(modules[moduleIndex].lessons);

        // Reorder array
        const [moved] = newLessons.splice(sourceIndex, 1);
        newLessons.splice(destIndex, 0, moved);

        // Update orders locally to match visual
        const updatedLessons = newLessons.map((l: any, i) => ({ ...l, order: i }));
        modules[moduleIndex].lessons = updatedLessons;
        onCourseChange({ ...course, modules });

        // Save to DB
        try {
            const res = await fetch(`/api/courses/${course.id}/lessons/reorder`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    list: updatedLessons.map(l => ({ id: l.id, order: l.order, moduleId: moduleId }))
                })
            });
            if (!res.ok) throw new Error("Failed");
        } catch (e) {
            // Revert on fail
            toast.error("Failed to reorder lessons");
            modules[moduleIndex].lessons = originalLessons;
            onCourseChange({ ...course, modules });
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
            onCourseChange({ ...course, modules: [...course.modules, newModule] });
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
            const newModules = course.modules.map((m: any) => {
                if (m.id === moduleId) {
                    return { ...m, lessons: [...m.lessons, newLesson] };
                }
                return m;
            });
            onCourseChange({ ...course, modules: newModules });
            onSelectLesson(newLesson.id);
        }
    }

    const togglePrerequisite = async (lesson: any, moduleId: string) => {
        // Toggle the isLocked attribute
        const isLocked = !lesson.isLocked;

        try {
            const res = await fetch(`/api/courses/${course.id}/modules/${moduleId}/lessons/${lesson.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isLocked })
            });

            if (res.ok) {
                const newModules = course.modules.map((m: any) => {
                    if (m.id === moduleId) {
                        return {
                            ...m,
                            lessons: m.lessons.map((l: any) => l.id === lesson.id ? { ...l, isLocked } : l)
                        };
                    }
                    return m;
                });
                onCourseChange({ ...course, modules: newModules });
                toast.success(isLocked ? "Lesson locked as prerequisite" : "Prerequisite removed");
            }
        } catch (e) {
            toast.error("Failed to update prerequisite");
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 border-r overflow-hidden">
            <div className="p-4 border-b shrink-0 flex items-center justify-between bg-white">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Syllabus</h2>
                <Button variant="ghost" size="icon" onClick={addModule}>
                    <PlusSignIcon className="w-4 h-4 text-slate-500" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <DragDropContext onDragEnd={handleDragEnd}>
                    {course.modules.map((module: any) => (
                        <div key={module.id} className="space-y-2">
                            <div className="flex items-center justify-between group">
                                <h3 className="font-medium text-slate-800 text-sm">
                                    {module.title}
                                </h3>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => addLesson(module.id)}>
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
                                                            className="flex-1 truncate cursor-pointer py-1"
                                                            onClick={() => onSelectLesson(lesson.id)}
                                                        >
                                                            {lesson.title}
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                togglePrerequisite(lesson, module.id);
                                                            }}
                                                            className={`p-1 rounded opacity-0 group-hover/lesson:opacity-100 transition-opacity ${lesson.isLocked ? 'text-amber-500 opacity-100' : 'text-slate-400 hover:text-amber-500'}`}
                                                            title={lesson.isLocked ? "Unlock lesson" : "Require previous completion"}
                                                        >
                                                            <LockPasswordIcon className="w-3.5 h-3.5" />
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
