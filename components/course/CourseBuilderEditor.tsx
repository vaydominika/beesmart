"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorInstance } from "novel";
import { useDebouncedCallback } from "use-debounce";
import {
  BookMarked,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
  WandSparkles,
  Upload,
  X,
} from "lucide-react";
import { Editor } from "@/components/ui/editor";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceCheckbox } from "@/components/ui/workspace-checkbox";
import type { CourseBuilderFile, CourseBuilderLesson } from "@/lib/course-builder";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CourseBuilderEditorProps {
  lesson: CourseBuilderLesson;
  courseId: string;
  previewMode?: boolean;
  autoPublish?: boolean;
  onLessonUpdate: (lesson: CourseBuilderLesson) => void;
  onSavingChange?: (saving: boolean) => void;
}

export default function CourseBuilderEditor({ lesson, courseId, previewMode = false, autoPublish = true, onLessonUpdate, onSavingChange }: CourseBuilderEditorProps) {
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.contentDraft || lesson.content || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isAIExpanded, setIsAIExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showFileInLesson, setShowFileInLesson] = useState(true);
  const [savingFileIds, setSavingFileIds] = useState<Set<string>>(() => new Set());
  const [reviewTool, setReviewTool] = useState<"glossary" | "quiz" | "improve" | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [sourceRange, setSourceRange] = useState<{ from: number; to: number } | null>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);
  const [glossary, setGlossary] = useState({ term: "", definition: "", example: "" });
  const [quiz, setQuiz] = useState({ type: "MULTIPLE_CHOICE", question: "", options: [] as string[], correctAnswer: "", explanation: "" });
  const [improvedContent, setImprovedContent] = useState("");
  const [improveMode, setImproveMode] = useState("clarity");
  const [customGoal, setCustomGoal] = useState("");
  const requestController = useRef<AbortController | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingChanges = useRef<{ title?: string; content?: string }>({});
  const latestLessonRef = useRef(lesson);

  const saveChanges = useDebouncedCallback(async (targetLessonId: string, targetModuleId: string) => {
    const changesToSave = { ...pendingChanges.current };
    if (Object.keys(changesToSave).length === 0) return;
    pendingChanges.current = {};
    setIsSaving(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/modules/${targetModuleId}/lessons/${targetLessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...changesToSave, autoPublish }),
      });
      if (!response.ok) throw new Error();
      onLessonUpdate(await response.json() as CourseBuilderLesson);
    } catch {
      pendingChanges.current = { ...changesToSave, ...pendingChanges.current };
      toast.error("Lesson changes could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }, 700);

  useEffect(() => {
    onSavingChange?.(isSaving || savingFileIds.size > 0);
  }, [isSaving, onSavingChange, savingFileIds]);

  useEffect(() => {
    latestLessonRef.current = lesson;
  }, [lesson]);

  useEffect(() => () => { saveChanges.flush(); }, [lesson.id, saveChanges]);

  useEffect(() => () => requestController.current?.abort(), []);

  useEffect(() => {
    saveChanges.cancel();
    pendingChanges.current = {};
    setTitle(lesson.title);
    setContent(lesson.contentDraft || lesson.content || "");
    setIsAIExpanded(false);
    setGenerationPrompt("");
    setSelectedFile(null);
    setSavingFileIds(new Set());
    requestController.current?.abort();
    setReviewTool(null);
  }, [lesson.id, lesson.content, lesson.contentDraft, lesson.title, saveChanges]);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = event.target.value;
    setTitle(nextTitle);
    pendingChanges.current.title = nextTitle;
    saveChanges(lesson.id, lesson.moduleId);
  };

  const handleContentChange = (value: string, editorId: string) => {
    if (editorId !== lesson.id || value === lesson.contentDraft || (!lesson.contentDraft && value === lesson.content)) return;
    setContent(value);
    pendingChanges.current.content = value;
    saveChanges(lesson.id, lesson.moduleId);
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
      pendingChanges.current.content = accumulated;
      saveChanges(lesson.id, lesson.moduleId);
      setIsAIExpanded(false);
      setGenerationPrompt("");
      setSelectedFile(null);
      toast.success("Lesson content created.", { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lesson content could not be generated.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedEditorText = () => {
    const editor = editorRef.current;
    if (!editor) return { text: "", range: null };
    const { from, to } = editor.state.selection;
    return { text: from === to ? "" : editor.state.doc.textBetween(from, to, " "), range: from === to ? null : { from, to } };
  };

  const openStructuredTool = (tool: "glossary" | "quiz") => {
    const selected = selectedEditorText();
    setGlossary({ term: "", definition: "", example: "" });
    setQuiz({ type: "MULTIPLE_CHOICE", question: "", options: [], correctAnswer: "", explanation: "" });
    setSourceText(selected.text);
    setSourceRange(selected.range);
    setToolError(null);
    setReviewTool(tool);
  };

  const openImproveTool = (scope: "selection" | "lesson") => {
    const selected = selectedEditorText();
    if (scope === "selection" && !selected.text.trim()) {
      toast.error("Select lesson text before improving a selection.");
      return;
    }
    setSourceText(scope === "selection" ? selected.text : (editorRef.current?.getHTML() || content));
    setSourceRange(scope === "selection" ? selected.range : null);
    setImprovedContent("");
    setToolError(null);
    setReviewTool("improve");
  };

  const runStructuredTool = async () => {
    if (!reviewTool || reviewTool === "improve") return;
    if (sourceText.trim().length < 20) {
      setToolError("Choose or enter at least 20 characters from this lesson.");
      return;
    }
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setToolLoading(true);
    setToolError(null);
    try {
      const endpoint = reviewTool === "glossary" ? "generate-glossary" : "generate-quiz-from-text";
      const response = await fetch(`/api/courses/${courseId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textEntry: sourceText, lessonId: lesson.id }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Generation failed");
      if (reviewTool === "glossary") setGlossary({ term: result.term || "", definition: result.definition || "", example: result.example || "" });
      else setQuiz({ type: result.type, question: result.question, options: result.options ?? [], correctAnswer: result.correctAnswer, explanation: result.explanation });
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") setToolError(cause instanceof Error ? cause.message : "Generation failed");
    } finally {
      setToolLoading(false);
    }
  };

  const runImprove = async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setToolLoading(true);
    setToolError(null);
    setImprovedContent("");
    try {
      const goals: Record<string, string> = { clarity: "Improve clarity and structure", simplify: "Use simpler language", expand: "Expand with useful educational detail", grammar: "Correct grammar and style", custom: customGoal };
      if (improveMode === "custom" && !customGoal.trim()) throw new Error("Describe your custom improvement goal.");
      const response = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sourceText, type: "lesson content", goal: goals[improveMode], context: lesson.title, courseId, lessonId: lesson.id }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Improvement failed");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No revision was returned");
      const decoder = new TextDecoder();
      let next = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        next += decoder.decode(value, { stream: true });
        setImprovedContent(next);
      }
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") setToolError(cause instanceof Error ? cause.message : "Improvement failed");
    } finally {
      setToolLoading(false);
    }
  };

  const syncAppliedContent = () => {
    const next = editorRef.current?.getHTML() || "";
    setContent(next);
    pendingChanges.current.content = next;
    saveChanges(lesson.id, lesson.moduleId);
    setReviewTool(null);
  };

  const insertApprovedHtml = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (sourceRange) editor.chain().focus().setTextSelection(sourceRange.to).insertContent(html).run();
    else editor.chain().focus().insertContent(html).run();
    syncAppliedContent();
  };

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));

  const applyGlossary = () => insertApprovedHtml(`<aside class="lesson-glossary" aria-label="Glossary term"><h3>${escapeHtml(glossary.term)}</h3><p>${escapeHtml(glossary.definition)}</p>${glossary.example ? `<p><strong>Example:</strong> ${escapeHtml(glossary.example)}</p>` : ""}</aside>`);
  const applyQuiz = () => insertApprovedHtml(`<section class="lesson-knowledge-check" aria-label="Knowledge check"><h3>Check your understanding</h3><p><strong>${escapeHtml(quiz.question)}</strong></p>${quiz.options.length ? `<ol>${quiz.options.map((option) => `<li>${escapeHtml(option)}</li>`).join("")}</ol>` : ""}<details><summary>Show answer</summary><p><strong>${escapeHtml(quiz.correctAnswer)}</strong></p><p>${escapeHtml(quiz.explanation)}</p></details></section>`);

  const applyImprovement = (action: "replace" | "insert") => {
    const editor = editorRef.current;
    if (!editor || !improvedContent) return;
    if (action === "replace" && sourceRange) editor.chain().focus().deleteRange(sourceRange).insertContent(improvedContent).run();
    else if (action === "replace") editor.commands.setContent(improvedContent, false);
    else if (sourceRange) editor.chain().focus().setTextSelection(sourceRange.to).insertContent(improvedContent).run();
    else editor.chain().focus().insertContent(improvedContent).run();
    syncAppliedContent();
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
      <article className="overflow-hidden rounded-3xl border border-[var(--course-line)] bg-white shadow-[0_8px_30px_rgba(32,35,31,0.06)]">
        <header className="border-b border-[var(--course-line)] bg-[var(--course-accent)] px-6 py-8 text-center md:px-10">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            aria-label="Lesson title"
            placeholder="Untitled lesson"
            className="w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-[-0.035em] text-[var(--course-text)] outline-none placeholder:text-[var(--course-text-faint)] focus:ring-0 md:text-[28px]"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => openStructuredTool("glossary")}><BookMarked className="h-4 w-4" />Glossary block</WorkspaceButton>
          <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => openStructuredTool("quiz")}><Sparkles className="h-4 w-4" />Knowledge check</WorkspaceButton>
          <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => openImproveTool("selection")}><WandSparkles className="h-4 w-4" />Improve selection</WorkspaceButton>
          <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => openImproveTool("lesson")}><WandSparkles className="h-4 w-4" />Improve lesson</WorkspaceButton>
          <WorkspaceButton type="button" variant={isAIExpanded ? "primary" : "secondary"} size="compact" onClick={() => setIsAIExpanded((current) => !current)} aria-expanded={isAIExpanded} aria-label="AI assist">
            <Sparkles className="h-4 w-4" />Create lesson
          </WorkspaceButton>
        </div>
      </div>

      {isAIExpanded && (
        <section className="rounded-xl border border-[var(--course-accent-hover)] bg-[var(--course-accent)] p-4" aria-label="AI lesson assistant">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-sm font-semibold">Build from a prompt or source</h2><p className="mt-1 text-xs leading-5 text-[var(--course-text-muted)]">Describe the lesson you need, optionally attach a source, then review the result before learners see it.</p></div>
            <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => setIsAIExpanded(false)} aria-label="Close AI assistant"><X className="h-4 w-4" /></WorkspaceButton>
          </div>

          <label className="mt-4 block">
            <span className="sr-only">Lesson generation prompt</span>
            <textarea value={generationPrompt} onChange={(event) => setGenerationPrompt(event.target.value)} placeholder="For example: Explain photosynthesis with a simple classroom experiment..." className="min-h-24 w-full resize-y rounded-xl border border-[var(--course-line)] bg-white px-3 py-2.5 text-sm leading-6 outline-none transition-colors placeholder:text-[var(--course-text-faint)] focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" />
          </label>

          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="sr-only" />
            <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />{selectedFile ? "Change source" : "Attach source"}
            </WorkspaceButton>
            {selectedFile && (
              <span className="flex h-9 min-w-0 items-center gap-2 rounded-lg bg-[var(--course-surface-muted)] px-3 text-xs font-medium">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--course-text-muted)]" /><span className="max-w-48 truncate">{selectedFile.name}</span><WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => setSelectedFile(null)} aria-label={`Remove ${selectedFile.name}`} className="-mr-2"><X className="h-3.5 w-3.5" /></WorkspaceButton>
              </span>
            )}
            <WorkspaceCheckbox
              label="Show source to learners"
              checked={showFileInLesson}
              onCheckedChange={setShowFileInLesson}
              containerClassName="shrink-0 px-1 text-xs"
            />
            <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => void handleGenerate()} disabled={isGenerating || (!generationPrompt.trim() && !selectedFile)} className="sm:ml-auto">
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{isGenerating ? "Creating..." : "Create content"}
            </WorkspaceButton>
          </div>
        </section>
      )}

      {lesson.files && lesson.files.length > 0 && (
        <section aria-label="Lesson attachments" className="flex flex-wrap gap-2">
          {lesson.files.map((file) => (
            <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--course-line)] bg-white p-2 pl-3">
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

      <section className="overflow-hidden rounded-xl border border-[var(--course-line)] bg-white" aria-label="Lesson content editor">
        <div className="min-h-[560px] px-5 py-6 md:px-7">
          <Editor initialValue={content} onChange={handleContentChange} onReady={(instance) => { editorRef.current = instance; }} placeholder="Start writing your lesson..." className="min-h-[470px]" id={lesson.id} />
        </div>
      </section>

      <Dialog open={reviewTool !== null} onOpenChange={(open) => { if (!open) { requestController.current?.abort(); setReviewTool(null); } }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-[var(--course-line)] bg-white">
          <DialogHeader><DialogTitle>{reviewTool === "glossary" ? "Create glossary block" : reviewTool === "quiz" ? "Create knowledge-check block" : "Review improved content"}</DialogTitle></DialogHeader>
          {reviewTool && reviewTool !== "improve" && <div className="space-y-4">
            {!((reviewTool === "glossary" && glossary.term) || (reviewTool === "quiz" && quiz.question)) && <>
              <label className="block"><span className="text-sm font-medium">Lesson text to use</span><textarea value={sourceText} onChange={(event) => setSourceText(event.target.value.slice(0, 12000))} maxLength={12000} className="mt-2 min-h-36 w-full resize-y rounded-xl border border-[var(--course-line)] px-3 py-2 text-sm outline-none focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" placeholder="Select text in the editor before opening this tool, or paste the lesson passage here." /><span className="mt-1 block text-right text-xs text-[var(--course-text-muted)]">{sourceText.length}/12,000</span></label>
              <div className="flex justify-end"><WorkspaceButton type="button" variant="primary" onClick={() => void runStructuredTool()} disabled={toolLoading}>{toolLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate draft</WorkspaceButton></div>
            </>}
            {toolError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{toolError}<WorkspaceButton type="button" variant="ghost" size="compact" onClick={() => void runStructuredTool()} className="ml-2">Retry</WorkspaceButton></div>}
            {reviewTool === "glossary" && glossary.term && <div className="space-y-3 rounded-xl border border-[var(--course-line)] p-4"><p className="text-xs font-semibold uppercase text-[var(--course-text-muted)]">Generated draft — edit before inserting</p><label className="block text-sm font-medium">Term<input value={glossary.term} onChange={(event) => setGlossary((current) => ({ ...current, term: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--course-line)] px-3" /></label><label className="block text-sm font-medium">Definition<textarea value={glossary.definition} onChange={(event) => setGlossary((current) => ({ ...current, definition: event.target.value }))} className="mt-1 min-h-24 w-full rounded-lg border border-[var(--course-line)] px-3 py-2" /></label><label className="block text-sm font-medium">Example<textarea value={glossary.example} onChange={(event) => setGlossary((current) => ({ ...current, example: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-[var(--course-line)] px-3 py-2" /></label><div className="flex justify-end gap-2"><WorkspaceButton type="button" variant="secondary" onClick={() => setGlossary({ term: "", definition: "", example: "" })}>Regenerate</WorkspaceButton><WorkspaceButton type="button" variant="primary" onClick={applyGlossary} disabled={!glossary.term.trim() || !glossary.definition.trim()}>Insert approved block</WorkspaceButton></div></div>}
            {reviewTool === "quiz" && quiz.question && <div className="space-y-3 rounded-xl border border-[var(--course-line)] p-4"><p className="text-xs font-semibold uppercase text-[var(--course-text-muted)]">Generated draft — editable lesson content, not a graded test</p><label className="block text-sm font-medium">Type<select value={quiz.type} onChange={(event) => setQuiz((current) => ({ ...current, type: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--course-line)] px-3"><option value="MULTIPLE_CHOICE">Multiple choice</option><option value="TRUE_FALSE">True / false</option><option value="SHORT_ANSWER">Short answer</option></select></label><label className="block text-sm font-medium">Question<textarea value={quiz.question} onChange={(event) => setQuiz((current) => ({ ...current, question: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-[var(--course-line)] px-3 py-2" /></label>{quiz.type === "MULTIPLE_CHOICE" && <label className="block text-sm font-medium">Options, one per line<textarea value={quiz.options.join("\n")} onChange={(event) => setQuiz((current) => ({ ...current, options: event.target.value.split("\n") }))} className="mt-1 min-h-24 w-full rounded-lg border border-[var(--course-line)] px-3 py-2" /></label>}<label className="block text-sm font-medium">Correct answer<input value={quiz.correctAnswer} onChange={(event) => setQuiz((current) => ({ ...current, correctAnswer: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--course-line)] px-3" /></label><label className="block text-sm font-medium">Explanation<textarea value={quiz.explanation} onChange={(event) => setQuiz((current) => ({ ...current, explanation: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-[var(--course-line)] px-3 py-2" /></label><div className="flex justify-end gap-2"><WorkspaceButton type="button" variant="secondary" onClick={() => setQuiz({ type: "MULTIPLE_CHOICE", question: "", options: [], correctAnswer: "", explanation: "" })}>Regenerate</WorkspaceButton><WorkspaceButton type="button" variant="primary" onClick={applyQuiz} disabled={!quiz.question.trim() || !quiz.correctAnswer.trim()}>Insert approved block</WorkspaceButton></div></div>}
          </div>}
          {reviewTool === "improve" && <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Improvement goal">{[{ value: "clarity", label: "Clarity" }, { value: "simplify", label: "Simplify" }, { value: "expand", label: "Expand" }, { value: "grammar", label: "Grammar" }, { value: "custom", label: "Custom goal" }].map((mode) => <WorkspaceButton key={mode.value} type="button" variant={improveMode === mode.value ? "primary" : "secondary"} size="compact" onClick={() => setImproveMode(mode.value)}>{mode.label}</WorkspaceButton>)}</div>
            {improveMode === "custom" && <input value={customGoal} maxLength={500} onChange={(event) => setCustomGoal(event.target.value)} placeholder="Describe the change you want..." className="h-10 w-full rounded-xl border border-[var(--course-line)] px-3 text-sm" />}
            {!improvedContent && <div className="rounded-xl border border-[var(--course-line)] p-4"><p className="text-xs font-semibold uppercase text-[var(--course-text-muted)]">Original</p><div className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6">{sourceText}</div><div className="mt-4 flex justify-end"><WorkspaceButton type="button" variant="primary" onClick={() => void runImprove()} disabled={toolLoading}>{toolLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />} Generate revision</WorkspaceButton></div></div>}
            {toolError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{toolError}<WorkspaceButton type="button" variant="ghost" size="compact" onClick={() => void runImprove()} className="ml-2">Retry</WorkspaceButton></div>}
            {improvedContent && <><div className="grid gap-4 md:grid-cols-2"><section className="rounded-xl border border-[var(--course-line)] p-4"><h3 className="text-xs font-semibold uppercase text-[var(--course-text-muted)]">Original</h3><div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-6">{sourceText}</div></section><section className="rounded-xl border border-[var(--course-accent-hover)] bg-[var(--course-accent)] p-4"><h3 className="text-xs font-semibold uppercase text-[var(--course-text-muted)]">Generated draft</h3><div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-6">{improvedContent}</div></section></div><div className="flex flex-wrap justify-end gap-2"><WorkspaceButton type="button" variant="secondary" onClick={() => void navigator.clipboard.writeText(improvedContent)}>Copy</WorkspaceButton><WorkspaceButton type="button" variant="secondary" onClick={() => applyImprovement("insert")}>Insert below</WorkspaceButton><WorkspaceButton type="button" variant="primary" onClick={() => applyImprovement("replace")}>Replace</WorkspaceButton></div></>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
