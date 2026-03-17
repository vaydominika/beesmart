import { useState, useEffect, useRef } from "react";
import { Editor } from "@/components/ui/editor";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { SparklesIcon, UploadIcon, XIcon, Loader2Icon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorInstance } from "novel";

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

    // AI State
    const [isAIExpanded, setIsAIExpanded] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationPrompt, setGenerationPrompt] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const editorRef = useRef<EditorInstance | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync on lesson switch
    useEffect(() => {
        setTitle(lesson.title);
        setContent(lesson.content || "");
        setIsAIExpanded(false);
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

    const handleGenerate = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        const toastId = toast.loading("AI is crafting your lesson...");

        try {
            const formData = new FormData();
            if (generationPrompt) formData.append("prompt", generationPrompt);
            if (selectedFile) formData.append("file", selectedFile);
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
            saveChanges(title, accumulated);
        } catch (e: any) {
            console.error("AI Generation Error:", e);
            toast.error(e.message || "Failed to generate lesson", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

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
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-[600px] border rounded-lg bg-white p-6 shadow-sm">
                <Editor
                    initialValue={content}
                    onChange={handleContentChange}
                    onReady={(inst) => { editorRef.current = inst; }}
                    placeholder="Start writing your lesson..."
                    className="min-h-[500px]"
                />
            </div>
        </div>
    );
}
