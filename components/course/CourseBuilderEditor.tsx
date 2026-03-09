"use client";

import { useState, useEffect } from "react";
import { Editor } from "@/components/ui/editor";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

interface CourseBuilderEditorProps {
    lesson: any;
    courseId: string;
    previewMode: boolean;
    onLessonUpdate: (lesson: any) => void;
}

export default function CourseBuilderEditor({ lesson, courseId, previewMode, onLessonUpdate }: CourseBuilderEditorProps) {
    const [title, setTitle] = useState(lesson.title);
    const [content, setContent] = useState(lesson.content || "");
    const [isSaving, setIsSaving] = useState(false);

    // Sync on lesson switch
    useEffect(() => {
        setTitle(lesson.title);
        setContent(lesson.content || "");
    }, [lesson.id]);

    const saveChanges = useDebouncedCallback(async (newTitle: string, newContent: string) => {
        if (!newTitle.trim()) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/modules/${lesson.moduleId}/lessons/${lesson.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle, content: newContent })
            });
            if (res.ok) {
                const updated = await res.json();
                onLessonUpdate(updated);
            }
        } catch (e) {
            toast.error("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    }, 1000);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        saveChanges(e.target.value, content);
    };

    const handleContentChange = (val: string) => {
        setContent(val);
        saveChanges(title, val);
    };

    if (previewMode) {
        return (
            <div className="prose dark:prose-invert max-w-none w-full border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 p-6 border-b text-center">
                    <h1 className="m-0 text-3xl">{lesson.title}</h1>
                </div>
                <div className="p-8 bg-white min-h-[50vh]">
                    {/* We use the TipTap editor in readonly so our custom React Node Views (Quiz) render correctly! */}
                    <Editor
                        initialValue={content}
                        editable={false}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    className="text-4xl font-bold bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300 w-full"
                    placeholder="Lesson Title..."
                />
                {isSaving && <span className="text-sm text-slate-400">Saving...</span>}
            </div>

            <div className="min-h-[500px] border rounded-lg bg-white p-6 shadow-sm">
                <Editor
                    initialValue={content}
                    onChange={handleContentChange}
                    placeholder="Start writing your lesson..."
                    className="min-h-[400px]"
                />
            </div>
        </div>
    );
}
