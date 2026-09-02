"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { EditorInstance } from "novel";
import {
  Eye,
  EyeOff,
  Loader2,
  Paperclip,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { Editor } from "@/components/ui/editor";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceCheckbox } from "@/components/ui/workspace-checkbox";
import type { CourseBuilderFile, CourseBuilderLesson } from "@/lib/course-builder";
import { cn } from "@/lib/utils";
import { AiUsageStatus, useAiUsage } from "@/components/ai/ai-usage";
import { CourseSourceFilePicker } from "./CourseSourceFilePicker";
import { AI_LESSON_PROMPT_CHARACTER_LIMIT } from "@/lib/ai/usage-shared";

interface CourseBuilderEditorProps {
  lesson: CourseBuilderLesson;
  courseId: string;
  previewMode?: boolean;
  onLessonUpdate: (lesson: CourseBuilderLesson) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
}

export interface CourseBuilderEditorHandle {
  save: () => Promise<boolean>;
}

const CourseBuilderEditor = forwardRef<CourseBuilderEditorHandle, CourseBuilderEditorProps>(function CourseBuilderEditor({ lesson, courseId, previewMode = false, onLessonUpdate, onDirtyChange, onSavingChange }, ref) {
  const savedContent = lesson.contentDraft ?? lesson.content ?? "";
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(savedContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isAIExpanded, setIsAIExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showFileInLesson, setShowFileInLesson] = useState(true);
  const [savingFileIds, setSavingFileIds] = useState<Set<string>>(() => new Set());
  const editorRef = useRef<EditorInstance | null>(null);
  const pendingChanges = useRef<{ title?: string; content?: string }>({});
  const saveInFlightRef = useRef(false);
  const latestLessonRef = useRef(lesson);
  const activeLessonIdRef = useRef(lesson.id);
  const { usage: aiUsage, exhausted: aiExhausted, refresh: refreshAiUsage, syncFromResponse: syncAiUsage } = useAiUsage("LESSON_CONTENT", isAIExpanded);

  const saveChanges = useCallback(async (targetLessonId: string, targetModuleId: string) => {
    const changesToSave = { ...pendingChanges.current };
    if (Object.keys(changesToSave).length === 0) return true;
    pendingChanges.current = {};
    saveInFlightRef.current = true;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/modules/${targetModuleId}/lessons/${targetLessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changesToSave),
      });
      if (!response.ok) throw new Error();
      onLessonUpdate(await response.json() as CourseBuilderLesson);
      if (Object.keys(pendingChanges.current).length === 0) onDirtyChange?.(false);
      return true;
    } catch {
      pendingChanges.current = { ...changesToSave, ...pendingChanges.current };
      onDirtyChange?.(true);
      toast.error("Lesson changes could not be saved.");
      return false;
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }, [courseId, onDirtyChange, onLessonUpdate]);

  useImperativeHandle(ref, () => ({
    save: () => saveChanges(lesson.id, lesson.moduleId),
  }), [lesson.id, lesson.moduleId, saveChanges]);

  useEffect(() => {
    onSavingChange?.(isSaving || savingFileIds.size > 0);
  }, [isSaving, onSavingChange, savingFileIds]);

  useEffect(() => {
    latestLessonRef.current = lesson;
  }, [lesson]);

  useEffect(() => {
    const lessonChanged = activeLessonIdRef.current !== lesson.id;
    activeLessonIdRef.current = lesson.id;

    if (!lessonChanged) {
      if (!saveInFlightRef.current && Object.keys(pendingChanges.current).length === 0) {
        setTitle(lesson.title);
        setContent(savedContent);
      }
      return;
    }

    pendingChanges.current = {};
    setTitle(lesson.title);
    setContent(savedContent);
    setIsAIExpanded(false);
    setGenerationPrompt("");
    setSelectedFile(null);
    setSavingFileIds(new Set());
    onDirtyChange?.(false);
  }, [lesson.id, lesson.title, onDirtyChange, savedContent]);

  const updatePendingChange = (key: "title" | "content", value: string, savedValue: string) => {
    if (value === savedValue) delete pendingChanges.current[key];
    else pendingChanges.current[key] = value;
    onDirtyChange?.(Object.keys(pendingChanges.current).length > 0);
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = event.target.value;
    setTitle(nextTitle);
    updatePendingChange("title", nextTitle, lesson.title);
  };

  const handleContentChange = (value: string, editorId: string) => {
    if (editorId !== lesson.id) return;
    setContent(value);
    updatePendingChange("content", value, savedContent);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const toastId = toast.loading("Creating lesson content...");
    try {
      const formData = new FormData();
      if (generationPrompt.trim()) formData.append("prompt", generationPrompt.trim());
      if (selectedFile) {
        formData.append("file", selectedFile);
        formData.append("isVisible", showFileInLesson.toString());
      }
      formData.append("existingContent", content);

      const response = await fetch(`/api/courses/${courseId}/lessons/${lesson.id}/generate`, { method: "POST", body: formData });
      syncAiUsage(response);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No generated content was returned");
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        editorRef.current?.chain().focus().setContent(accumulated, false).run();
      }

      setContent(accumulated);
      updatePendingChange("content", accumulated, savedContent);
      setIsAIExpanded(false);
      setGenerationPrompt("");
      setSelectedFile(null);
      toast.success("Lesson content created.", { id: toastId });
    } catch (error) {
      void refreshAiUsage();
      toast.error(error instanceof Error ? error.message : "Lesson content could not be generated.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const applyFileVisibility = (fileId: string, isVisible: boolean, serverFile?: CourseBuilderFile) => {
    const currentLesson = latestLessonRef.current;
    const nextLesson = {
      ...currentLesson,
      files: currentLesson.files?.map((file) => file.id === fileId
        ? { ...file, ...serverFile, isVisible }
        : file),
    };
    latestLessonRef.current = nextLesson;
    onLessonUpdate(nextLesson);
  };

  const handleFileVisibilityChange = async (file: CourseBuilderFile) => {
    if (savingFileIds.has(file.id)) return;
    const nextVisibility = !file.isVisible;
    applyFileVisibility(file.id, nextVisibility);
    setSavingFileIds((current) => new Set(current).add(file.id));

    try {
      const response = await fetch(`/api/courses/${courseId}/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: nextVisibility }),
      });
      if (!response.ok) throw new Error();
      const updatedFile = await response.json() as CourseBuilderFile;
      applyFileVisibility(file.id, updatedFile.isVisible, updatedFile);
      toast.success(nextVisibility ? `${file.fileName} is visible to learners.` : `${file.fileName} is hidden from learners.`);
    } catch {
      applyFileVisibility(file.id, file.isVisible);
      toast.error(`${file.fileName} visibility could not be updated.`);
    } finally {
      setSavingFileIds((current) => {
        const next = new Set(current);
        next.delete(file.id);
        return next;
      });
    }
  };

  if (previewMode) {
    return (
      <article className="overflow-hidden rounded-3xl border border-[var(--course-line)] bg-[var(--app-surface)] shadow-[var(--app-shadow-soft)]">
        <header className="border-b border-[var(--course-line)] bg-[var(--app-surface)] px-6 py-8 text-center md:px-10">
          <p className="mb-2 text-[11px] font-semibold text-[var(--course-text-muted)]">Learner preview</p>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] md:text-3xl">{lesson.title}</h1>
        </header>
        <div className="min-h-[55vh] px-6 py-8 md:px-10">
          <Editor initialValue={content} editable={false} id={lesson.id} />
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor={`lesson-title-${lesson.id}`} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--course-text-muted)]">
            <Pencil className="h-3.5 w-3.5" />Lesson title<span className="rounded-md bg-[var(--course-surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--course-text-faint)]">Editable</span>
          </label>
          <input
            id={`lesson-title-${lesson.id}`}
            type="text"
            value={title}
            onChange={handleTitleChange}
            aria-label="Lesson title"
            placeholder="Untitled lesson"
            className="-mx-2 h-11 w-[calc(100%+1rem)] rounded-lg border-0 bg-transparent px-2 text-2xl font-semibold tracking-[-0.035em] text-[var(--course-text)] outline-none transition-colors placeholder:text-[var(--course-text-faint)] hover:bg-[var(--course-surface-muted)] hover:text-[var(--course-text-muted)] motion-reduce:transition-none md:text-[28px]"
          />
        </div>
        <div className="flex justify-end sm:pb-1.5">
          <WorkspaceButton type="button" variant={isAIExpanded ? "primary" : "secondary"} size="compact" onClick={() => setIsAIExpanded((current) => !current)} aria-expanded={isAIExpanded} aria-label="Create lesson">
            <Sparkles className="h-4 w-4" />Create lesson
          </WorkspaceButton>
        </div>
      </div>

      {isAIExpanded && (
        <section className="rounded-xl border border-[var(--course-line)] bg-[var(--course-accent)] p-4" aria-label="AI lesson assistant">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-sm font-semibold">Build from a prompt or source</h2><p className="mt-1 text-xs leading-5 text-[var(--course-text-muted)]">Describe the lesson you need, optionally attach a source, then review the result before learners see it.</p><AiUsageStatus usage={aiUsage} className="mt-1.5" /></div>
            <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => setIsAIExpanded(false)} aria-label="Close AI assistant"><X className="h-4 w-4" /></WorkspaceButton>
          </div>

          <label className="mt-4 block">
            <span className="sr-only">Lesson generation prompt</span>
            <textarea aria-label="Lesson generation prompt" value={generationPrompt} maxLength={AI_LESSON_PROMPT_CHARACTER_LIMIT} onChange={(event) => setGenerationPrompt(event.target.value)} placeholder="For example: Explain photosynthesis with a simple classroom experiment..." className="min-h-24 w-full resize-y rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] px-3 py-2.5 text-sm leading-6 outline-none transition-colors placeholder:text-[var(--course-text-faint)] focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" />
            <span className="mt-1 block text-right text-[10px] text-[var(--course-text-faint)]">{generationPrompt.length.toLocaleString()}/{AI_LESSON_PROMPT_CHARACTER_LIMIT.toLocaleString()}</span>
          </label>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-[auto_auto_1fr] sm:items-center">
            <CourseSourceFilePicker file={selectedFile} onFileChange={setSelectedFile} className="w-fit" />
            <WorkspaceCheckbox
              label="Show source to learners"
              checked={showFileInLesson}
              onCheckedChange={setShowFileInLesson}
              containerClassName="shrink-0 px-1 text-xs"
              indicatorClassName="peer-checked:border-[var(--app-border-strong)] peer-checked:bg-[var(--app-surface)]"
            />
            <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => void handleGenerate()} disabled={isGenerating || aiExhausted || (!generationPrompt.trim() && !selectedFile)} className="enabled:text-[var(--course-text)] sm:justify-self-end">
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{isGenerating ? "Creating..." : "Create content"}
            </WorkspaceButton>
          </div>
          <p className="mt-2 w-fit max-w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[10px] leading-4 text-[var(--app-text-muted)]">Source files can contain up to 12,000 extracted characters.</p>
        </section>
      )}

      {lesson.files && lesson.files.length > 0 && (
        <section aria-label="Lesson attachments" className="flex flex-wrap gap-2">
          {lesson.files.map((file) => (
            <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] p-2 pl-3">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--course-text-muted)]" />
              <span className="max-w-52 truncate text-xs font-medium">{file.fileName}</span>
              <span className="font-mono text-[9px] text-[var(--course-text-faint)]">{Math.max(0.1, file.fileSize / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                role="switch"
                aria-checked={file.isVisible}
                aria-label={file.isVisible ? `Hide ${file.fileName} from learners` : `Show ${file.fileName} to learners`}
                disabled={savingFileIds.has(file.id)}
                onClick={() => void handleFileVisibilityChange(file)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-ring)] disabled:cursor-wait disabled:opacity-60",
                  file.isVisible
                    ? "bg-[var(--course-accent)] text-[var(--course-text)] hover:bg-[var(--course-accent-hover)]"
                    : "bg-[var(--course-surface-muted)] text-[var(--course-text-muted)] hover:text-[var(--course-text)]",
                )}
              >
                {file.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {file.isVisible ? "Visible" : "Hidden"}
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] transition-[border-color,box-shadow] focus-within:border-[var(--course-focus-border)] focus-within:ring-2 focus-within:ring-[var(--course-focus-ring)]" aria-label="Lesson content editor">
        <div className="min-h-[560px] px-5 py-6 md:px-7">
          <Editor initialValue={content} onChange={handleContentChange} onReady={(instance) => { editorRef.current = instance; }} placeholder="Start writing your lesson..." className="min-h-[470px]" id={lesson.id} />
        </div>
      </section>

    </div>
  );
});

export default CourseBuilderEditor;
