import { useState, useEffect, useRef } from "react";
import { Editor } from "@/components/ui/editor";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { SparklesIcon, UploadIcon, XIcon, Loader2Icon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorInstance } from "novel";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface CourseBuilderEditorProps {
    lesson: any;
    courseId: string;
    previewMode?: boolean;
    autoPublish?: boolean;
    onLessonUpdate: (lesson: any) => void;
    onSavingChange?: (saving: boolean) => void;
}

export default function CourseBuilderEditor({ lesson, courseId, previewMode = false, autoPublish = true, onLessonUpdate, onSavingChange }: CourseBuilderEditorProps) {
    const [title, setTitle] = useState(lesson.title);
    const [content, setContent] = useState(lesson.contentDraft || lesson.content || "");
    const [isSaving, setIsSaving] = useState(false);

    // Report saving state to parent
    useEffect(() => {
        onSavingChange?.(isSaving);
    }, [isSaving, onSavingChange]);

    // AI State
    const [isAIExpanded, setIsAIExpanded] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationPrompt, setGenerationPrompt] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showFileInLesson, setShowFileInLesson] = useState(true);
    const editorRef = useRef<EditorInstance | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingChanges = useRef<{ title?: string; content?: string }>({});

    // Sync on lesson switch
    useEffect(() => {
        console.log("[CourseBuilderEditor] Lesson switched to:", lesson.id, "Title:", lesson.title, "Content length:", (lesson.content || "").length);

        // This runs for the OUTGOING lesson when [lesson.id] changes.
        // It ensures any pending edits for the old lesson are saved before we clear state.
        return () => {
            console.log("[CourseBuilderEditor] Switching away, flushing pending saves.");
            saveChanges.flush();
        };
    }, [lesson.id]);

    // Secondary effect to reset state AFTER potential flush.
    useEffect(() => {
        // Cancel any pending saves for the previous lesson (already flushed above)
        saveChanges.cancel();
        pendingChanges.current = {}; // Reset accumulation

        setTitle(lesson.title);
        setContent(lesson.contentDraft || lesson.content || "");
        setIsAIExpanded(false);
    }, [lesson.id]);

    const saveChanges = useDebouncedCallback(async (targetLessonId: string, targetModuleId: string) => {
        const changesToSave = { ...pendingChanges.current };
        console.log("[CourseBuilderEditor] saveChanges triggered for ID:", targetLessonId, "Changes:", changesToSave);

        if (Object.keys(changesToSave).length === 0) {
            console.log("[CourseBuilderEditor] No changes to save, skipping.");
            return;
        }

        // Reset before starting async to prevent double-saving same values
        pendingChanges.current = {};

        setIsSaving(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/modules/${targetModuleId}/lessons/${targetLessonId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...changesToSave, autoPublish })
            });
            if (res.ok) {
                const updated = await res.json();
                console.log("[CourseBuilderEditor] PATCH success for ID:", updated.id, "Current lesson.id:", lesson.id);

                // ALWAYS update the parent, even if we've switched away.
                // onLessonUpdate is ID-smart and will update the correct lesson in memory,
                // preventing a "revert" if the user switches back to this lesson later.
                onLessonUpdate(updated);
            } else {
                console.error("[CourseBuilderEditor] PATCH failed with status:", res.status);
            }
        } catch (e) {
            console.error("[CourseBuilderEditor] Save error:", e);
            toast.error("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    }, 700);

    const handleGenerate = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        const toastId = toast.loading("AI is crafting your lesson...");

        try {
            const formData = new FormData();
            if (generationPrompt) formData.append("prompt", generationPrompt);
            if (selectedFile) {
                formData.append("file", selectedFile);
                formData.append("isVisible", showFileInLesson.toString());
            }
            formData.append("existingContent", content);

            const res = await fetch(`/api/courses/${courseId}/lessons/${lesson.id}/generate`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Generation failed");
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No reader available");

            let accumulated = "";
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accumulated += chunk;

                // Update TipTap directly for real-time visualization
                if (editorRef.current) {
                    editorRef.current.chain().focus().setContent(accumulated, false).run();
                }
            }

            toast.success("Lesson generated successfully!", { id: toastId });
            setIsAIExpanded(false);
            setGenerationPrompt("");
            setSelectedFile(null);

            // Final sync and save
            setContent(accumulated);
            pendingChanges.current.content = accumulated;
            saveChanges(lesson.id, lesson.moduleId);
        } catch (e: any) {
            console.error("AI Generation Error:", e);
            toast.error(e.message || "Failed to generate lesson", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextTitle = e.target.value;
        console.log("[CourseBuilderEditor] handleTitleChange:", nextTitle);
        setTitle(nextTitle);
        pendingChanges.current.title = nextTitle;
        saveChanges(lesson.id, lesson.moduleId);
    };

    const handleContentChange = (val: string, editorId: string) => {
        // ID-QUALIFIED GUARD (Phase 4): 
        // If the editor sends an update but it's not for our current lesson ID,
        // it's a "ghost" update from a previous session. KILL IT.
        if (editorId !== lesson.id) {
            console.warn("[CourseBuilderEditor] REJECTED ghost update! Active ID:", lesson.id, "but update was for:", editorId);
            return;
        }

        // SAFETY: If the new content is exactly the same as the existing lesson content, 
        // it means this was likely an internal editor update (e.g. from props) that shouldn't trigger a save.
        if (val === lesson.content) {
            console.log("[CourseBuilderEditor] handleContentChange: value identical to lesson.content, ignoring save.");
            return;
        }

        console.log("[CourseBuilderEditor] handleContentChange (val length):", val.length);
        setContent(val);
        pendingChanges.current.content = val;
        saveChanges(lesson.id, lesson.moduleId);
    };

    if (previewMode) {
        return (
            <div className="prose dark:prose-invert max-w-none w-full border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 p-6 border-b text-center">
                    <h1 className="m-0 text-3xl">{lesson.title}</h1>
                </div>
                <div className="p-8 bg-white min-h-[50vh]">
                    <Editor
                        initialValue={content}
                        editable={false}
                        id={lesson.id}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        className="text-4xl font-bold bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300 w-full"
                        placeholder="Lesson Title..."
                    />
                </div>
                <div className="flex items-center gap-4">
                    {isSaving && <span className="text-sm text-slate-400">Saving...</span>}
                    <Button
                        onClick={() => setIsAIExpanded(!isAIExpanded)}
                        variant={isAIExpanded ? "secondary" : "default"}
                        className="gap-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 border-none shadow-md text-white font-bold"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        AI Assist
                    </Button>
                </div>
            </div>

            {isAIExpanded && (
                <div className="bg-gradient-to-br from-slate-50 to-white border-2 border-amber-100 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5" />
                                Generate Lesson Content
                            </h3>
                            <button onClick={() => setIsAIExpanded(false)} className="text-slate-400 hover:text-slate-600">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-amber-800/70">
                            Describe what you want to teach or upload a file (PDF/Img) to use as the source. AI will write the lesson for you!
                        </p>

                        <div className="flex flex-col gap-3">
                            <textarea
                                value={generationPrompt}
                                onChange={(e) => setGenerationPrompt(e.target.value)}
                                placeholder="e.g. Expand on the history of bees, or 'Summarize the attached file'..."
                                className="w-full min-h-[100px] p-3 rounded-lg border border-amber-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm resize-none bg-white/50"
                            />

                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,image/*"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-dashed border-amber-300 bg-amber-50/30 hover:bg-amber-50 text-amber-700 gap-2 h-10 px-4"
                                >
                                    <UploadIcon className="w-4 h-4" />
                                    {selectedFile ? "Change File" : "Upload Source File"}
                                </Button>

                                {selectedFile && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full text-xs font-medium text-amber-800">
                                        <FileIcon className="w-3 h-3" />
                                        <span className="truncate max-w-[150px]">{selectedFile.name}</span>
                                        <button onClick={() => setSelectedFile(null)} className="hover:text-red-500">
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                                <div className="flex-1" />

                                <Button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px] gap-2 h-10 shadow-lg"
                                >
                                    {isGenerating ? (
                                        <Loader2Icon className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <SparklesIcon className="w-4 h-4" />
                                    )}
                                    {isGenerating ? "Generating..." : "Generate"}
                                </Button>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={showFileInLesson}
                                            onChange={(e) => setShowFileInLesson(e.target.checked)}
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:bg-amber-600 checked:border-amber-600"
                                        />
                                        <HugeiconsIcon icon={Tick01Icon} className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                    </div>
                                    <span className="text-sm font-medium text-amber-900/80 group-hover:text-amber-900 transition-colors">
                                        Show file in lesson for students
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Attached Files List */}
            {lesson.files && lesson.files.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    {lesson.files.map((file: any) => (
                        <div key={file.id} className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl group hover:border-slate-300 transition-all">
                            <div className="size-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                <FileIcon className="size-4 text-slate-400" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{file.fileName}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        {(file.fileSize / 1024).toFixed(1)} KB
                                    </span>
                                    <div className="size-1 bg-slate-200 rounded-full" />
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-wider",
                                        file.isVisible ? "text-emerald-500" : "text-slate-400"
                                    )}>
                                        {file.isVisible ? "Visible" : "Hidden"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="min-h-[600px] border rounded-lg bg-white p-6 shadow-sm">
                <Editor
                    initialValue={content}
                    onChange={handleContentChange}
                    onReady={(inst) => { editorRef.current = inst; }}
                    placeholder="Start writing your lesson..."
                    className="min-h-[500px]"
                    id={lesson.id}
                />
            </div>
        </div>
    );
}
