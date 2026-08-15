"use client";

import { useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CourseBuilderCourse, CourseBuilderLesson, CourseBuilderModule } from "@/lib/course-builder";
import { lessonCount, reorderModules } from "@/lib/course-builder";
import { cn } from "@/lib/utils";
import { AiUsageStatus, useAiUsage } from "@/components/ai/ai-usage";
import { AI_SOURCE_CHARACTER_LIMIT } from "@/lib/ai/usage-shared";

interface CourseBuilderSidebarProps {
  course: CourseBuilderCourse;
  onCourseChange: (course: Partial<CourseBuilderCourse>) => void;
  activeLessonId: string | null;
  onSelectLesson: (id: string | null) => void;
  isSaving?: boolean;
}

type GeneratedOutline = {
  modules: Array<{ title: string; description?: string; lessons: Array<{ title: string; description?: string }> }>;
};

type DeleteTarget =
  | { type: "module"; id: string; title: string }
  | { type: "lesson"; id: string; moduleId: string; title: string };

export default function CourseBuilderSidebar({ course, onCourseChange, activeLessonId, onSelectLesson, isSaving = false }: CourseBuilderSidebarProps) {
  const [isAIExpanded, setIsAIExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [newModuleOpen, setNewModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { usage: aiUsage, exhausted: aiExhausted, refresh: refreshAiUsage, syncFromResponse: syncAiUsage } = useAiUsage("SYLLABUS", isAIExpanded);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.type === "MODULE") {
      if (result.source.index === result.destination.index) return;
      const previousModules = course.modules;
      const nextModules = reorderModules(course.modules, result.source.index, result.destination.index);
      if (nextModules === previousModules) return;
      onCourseChange({ modules: nextModules });

      try {
        const response = await fetch(`/api/courses/${course.id}/modules/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ list: nextModules.map((module) => ({ id: module.id, order: module.order })) }),
        });
        if (!response.ok) throw new Error();
      } catch {
        onCourseChange({ modules: previousModules });
        toast.error("Module order could not be saved.");
      }
      return;
    }

    const sourceModuleId = result.source.droppableId;
    const destinationModuleId = result.destination.droppableId;
    if (sourceModuleId === destinationModuleId && result.source.index === result.destination.index) return;

    const previousModules = course.modules;
    const nextModules = course.modules.map((module) => ({ ...module, lessons: [...module.lessons] }));
    const sourceModule = nextModules.find((module) => module.id === sourceModuleId);
    const destinationModule = nextModules.find((module) => module.id === destinationModuleId);
    if (!sourceModule || !destinationModule) return;

    const [movedLesson] = sourceModule.lessons.splice(result.source.index, 1);
    if (!movedLesson) return;
    destinationModule.lessons.splice(result.destination.index, 0, { ...movedLesson, moduleId: destinationModuleId });

    sourceModule.lessons = sourceModule.lessons.map((lesson, order) => ({ ...lesson, order }));
    if (sourceModule.id !== destinationModule.id) {
      destinationModule.lessons = destinationModule.lessons.map((lesson, order) => ({ ...lesson, order, moduleId: destinationModule.id }));
    }
    onCourseChange({ modules: nextModules });

    const changedModules = sourceModule.id === destinationModule.id ? [sourceModule] : [sourceModule, destinationModule];
    const list = changedModules.flatMap((module) => module.lessons.map((lesson) => ({ id: lesson.id, order: lesson.order, moduleId: module.id })));

    try {
      const response = await fetch(`/api/courses/${course.id}/lessons/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list }),
      });
      if (!response.ok) throw new Error();
    } catch {
      onCourseChange({ modules: previousModules });
      toast.error("Lesson order could not be saved.");
    }
  };

  const addModule = async () => {
    const title = newModuleTitle.trim();
    if (!title) return;
    try {
      const response = await fetch(`/api/courses/${course.id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: "" }),
      });
      if (!response.ok) throw new Error();
      const newModule = await response.json() as CourseBuilderModule;
      onCourseChange({ modules: [...course.modules, { ...newModule, lessons: newModule.lessons ?? [] }] });
      setNewModuleTitle("");
      setNewModuleOpen(false);
    } catch {
      toast.error("The module could not be created.");
    }
  };

  const addLesson = async (moduleId: string) => {
    const title = newLessonTitle.trim();
    if (!title) return;
    try {
      const response = await fetch(`/api/courses/${course.id}/modules/${moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: "", content: "" }),
      });
      if (!response.ok) throw new Error();
      const newLesson = await response.json() as CourseBuilderLesson;
      onCourseChange({
        modules: course.modules.map((module) => module.id === moduleId ? { ...module, lessons: [...module.lessons, newLesson] } : module),
      });
      setLessonModuleId(null);
      setNewLessonTitle("");
      onSelectLesson(newLesson.id);
    } catch {
      toast.error("The lesson could not be created.");
    }
  };

  const renameModule = async (module: CourseBuilderModule) => {
    const title = editingModuleTitle.trim();
    if (!title) return;
    if (title === module.title) {
      setEditingModuleId(null);
      return;
    }

    setIsMutating(true);
    try {
      const response = await fetch(`/api/courses/${course.id}/modules/${module.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error();
      onCourseChange({ modules: course.modules.map((item) => item.id === module.id ? { ...item, title } : item) });
      setEditingModuleId(null);
      toast.success("Module renamed.");
    } catch {
      toast.error("The module name could not be saved.");
    } finally {
      setIsMutating(false);
    }
  };

  const renameLesson = async (lesson: CourseBuilderLesson, moduleId: string) => {
    const title = editingLessonTitle.trim();
    if (!title) return;
    if (title === lesson.title) {
      setEditingLessonId(null);
      return;
    }

    setIsMutating(true);
    try {
      const response = await fetch(`/api/courses/${course.id}/modules/${moduleId}/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error();
      onCourseChange({
        modules: course.modules.map((module) => module.id === moduleId
          ? { ...module, lessons: module.lessons.map((item) => item.id === lesson.id ? { ...item, title } : item) }
          : module),
      });
      setEditingLessonId(null);
      toast.success("Lesson renamed.");
    } catch {
      toast.error("The lesson name could not be saved.");
    } finally {
      setIsMutating(false);
    }
  };

  const deleteSyllabusItem = async () => {
    if (!deleteTarget) return;
    setIsMutating(true);
    try {
      const endpoint = deleteTarget.type === "module"
        ? `/api/courses/${course.id}/modules/${deleteTarget.id}`
        : `/api/courses/${course.id}/modules/${deleteTarget.moduleId}/lessons/${deleteTarget.id}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) throw new Error();

      const nextModules = deleteTarget.type === "module"
        ? course.modules.filter((module) => module.id !== deleteTarget.id)
        : course.modules.map((module) => module.id === deleteTarget.moduleId
          ? { ...module, lessons: module.lessons.filter((lesson) => lesson.id !== deleteTarget.id) }
          : module);
      const removedActiveLesson = deleteTarget.type === "lesson"
        ? activeLessonId === deleteTarget.id
        : course.modules.find((module) => module.id === deleteTarget.id)?.lessons.some((lesson) => lesson.id === activeLessonId);

      onCourseChange({ modules: nextModules });
      if (removedActiveLesson) onSelectLesson(nextModules.flatMap((module) => module.lessons)[0]?.id ?? null);
      toast.success(deleteTarget.type === "module" ? "Module deleted." : "Lesson deleted.");
      setDeleteTarget(null);
    } catch {
      toast.error(deleteTarget.type === "module" ? "The module could not be deleted." : "The lesson could not be deleted.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleBulkGenerate = async () => {
    const text = sourceText.trim();
    if (!selectedFile && !text) return;
    setIsGenerating(true);
    const toastId = toast.loading("Building a syllabus from your source...");
    try {
      const formData = new FormData();
      if (selectedFile) formData.append("file", selectedFile);
      if (text) formData.append("text", text);
      const generateResponse = await fetch(`/api/courses/${course.id}/generate-from-file`, { method: "POST", body: formData });
      syncAiUsage(generateResponse);
      if (!generateResponse.ok) {
        const error = await generateResponse.json().catch(() => ({}));
        throw new Error(error.error || "Outline generation failed");
      }
      const { outline } = await generateResponse.json() as { outline: GeneratedOutline };
      const createdModules: CourseBuilderModule[] = [];

      for (const generatedModule of outline.modules) {
        const moduleResponse = await fetch(`/api/courses/${course.id}/modules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: generatedModule.title, description: generatedModule.description }),
        });
        if (!moduleResponse.ok) continue;
        const newModule = await moduleResponse.json() as CourseBuilderModule;
        const createdLessons: CourseBuilderLesson[] = [];

        for (const generatedLesson of generatedModule.lessons) {
          const lessonResponse = await fetch(`/api/courses/${course.id}/modules/${newModule.id}/lessons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: generatedLesson.title, description: generatedLesson.description, content: "" }),
          });
          if (lessonResponse.ok) createdLessons.push(await lessonResponse.json() as CourseBuilderLesson);
        }
        createdModules.push({ ...newModule, lessons: createdLessons });
      }

      onCourseChange({ modules: [...course.modules, ...createdModules] });
      setIsAIExpanded(false);
      setSelectedFile(null);
      setSourceText("");
      toast.success("Syllabus created from your source.", { id: toastId });
    } catch (error) {
      void refreshAiUsage();
      toast.error(error instanceof Error ? error.message : "The syllabus could not be generated.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePrerequisite = async (lesson: CourseBuilderLesson, moduleId: string) => {
    const isLocked = !lesson.isLocked;
    try {
      const response = await fetch(`/api/courses/${course.id}/modules/${moduleId}/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked }),
      });
      if (!response.ok) throw new Error();
      onCourseChange({
        modules: course.modules.map((module) => module.id === moduleId
          ? { ...module, lessons: module.lessons.map((item) => item.id === lesson.id ? { ...item, isLocked } : item) }
          : module),
      });
      toast.success(isLocked ? "Lesson locked until earlier work is complete." : "Lesson unlocked.");
    } catch {
      toast.error("The lesson lock could not be updated.");
    }
  };

  const toggleModule = (moduleId: string) => {
    setCollapsedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-surface)]">
      <div className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-[var(--course-line)] px-3 pr-12 lg:pr-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--course-text)]">Syllabus</h2>
          <p className="mt-1 text-[10px] text-[var(--course-text-muted)]">{course.modules.length} modules / {lessonCount(course)} lessons</p>
        </div>
        <div className="flex gap-2">
          <WorkspaceButton type="button" variant={isAIExpanded ? "primary" : "secondary"} size="icon-compact" onClick={() => setIsAIExpanded((current) => !current)} disabled={isSaving} aria-label="Generate syllabus with AI" aria-expanded={isAIExpanded}>
            <Sparkles className="h-4 w-4" />
          </WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => setNewModuleOpen(true)} disabled={isSaving}>
            <Plus className="h-3.5 w-3.5" />Module
          </WorkspaceButton>
        </div>
      </div>

      <div className="course-scroll min-h-0 flex-1 overflow-y-auto p-2.5">
        {isAIExpanded && (
          <div className="mb-2.5 rounded-xl border border-[var(--course-accent-hover)] bg-[var(--course-accent)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-semibold">Create an outline</p><p className="mt-1 text-[11px] leading-4 text-[var(--course-text-muted)]">Paste notes or add a file to build a syllabus.</p><AiUsageStatus usage={aiUsage} className="mt-1.5" /></div>
              <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => { setIsAIExpanded(false); setSelectedFile(null); setSourceText(""); }} aria-label="Close outline generator"><X className="h-3.5 w-3.5" /></WorkspaceButton>
            </div>
            <label htmlFor="outline-source-text" className="mt-3 block text-[10px] font-semibold text-[var(--course-text-muted)]">Source text</label>
            <textarea
              id="outline-source-text"
              aria-label="Outline source text"
              value={sourceText}
              maxLength={AI_SOURCE_CHARACTER_LIMIT}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Paste notes, lesson ideas, or source material..."
              rows={4}
              className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_80%,transparent)] px-3 py-2.5 text-xs leading-5 outline-none placeholder:text-[var(--course-text-faint)] focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]"
            />
            <span className="mt-1 block text-right text-[9px] text-[var(--course-text-faint)]">{sourceText.length.toLocaleString()}/{AI_SOURCE_CHARACTER_LIMIT.toLocaleString()}</span>
            <div className="my-2.5 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--course-text-faint)]" aria-hidden="true"><span className="h-px flex-1 bg-[var(--course-line)]" /><span>or add a file</span><span className="h-px flex-1 bg-[var(--course-line)]" /></div>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="sr-only" />
            <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => fileInputRef.current?.click()} className="w-full justify-start border-dashed">
              {selectedFile ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}<span className="min-w-0 flex-1 truncate">{selectedFile?.name ?? "Choose a source file"}</span>
            </WorkspaceButton>
            <p className="mt-1.5 w-fit max-w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[9px] leading-4 text-[var(--app-text-muted)]">Text and extracted file content share the 12,000-character source limit.</p>
            <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => void handleBulkGenerate()} disabled={(!selectedFile && !sourceText.trim()) || isGenerating || aiExhausted} className="mt-2 w-full">
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{isGenerating ? "Creating..." : "Create syllabus"}
            </WorkspaceButton>
          </div>
        )}

        {newModuleOpen && (
          <div className="mb-2.5 flex gap-1.5">
            <input autoFocus value={newModuleTitle} onChange={(event) => setNewModuleTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addModule(); if (event.key === "Escape") setNewModuleOpen(false); }} placeholder="Module title" aria-label="New module title" className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-3 text-sm outline-none focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" />
            <WorkspaceButton type="button" variant="primary" size="icon" onClick={() => void addModule()} disabled={!newModuleTitle.trim()} aria-label="Add module"><Check className="h-4 w-4" /></WorkspaceButton>
            <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => { setNewModuleOpen(false); setNewModuleTitle(""); }} aria-label="Cancel new module"><X className="h-4 w-4" /></WorkspaceButton>
          </div>
        )}
        {course.modules.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--course-line-strong)] px-5 text-center">
            <BookOpen className="mb-3 h-5 w-5 text-[var(--course-text-faint)]" />
            <p className="text-sm font-semibold">No modules yet</p>
            <p className="mt-1 text-xs leading-5 text-[var(--course-text-muted)]">Add one yourself or generate a syllabus from a file.</p>
            <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => setNewModuleOpen(true)} className="mt-4">Add module</WorkspaceButton>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="course-modules" type="MODULE">
              {(moduleListProvided) => (
                <div ref={moduleListProvided.innerRef} {...moduleListProvided.droppableProps} className="space-y-2">
                  {course.modules.map((module, moduleIndex) => {
                    const collapsed = collapsedModules.has(module.id);
                    return (
                      <Draggable key={module.id} draggableId={`module-${module.id}`} index={moduleIndex} isDragDisabled={isSaving || course.modules.length < 2}>
                        {(moduleDragProvided, moduleDragSnapshot) => (
                          <section
                            ref={moduleDragProvided.innerRef}
                            {...moduleDragProvided.draggableProps}
                            className={cn(
                              "overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] transition-[box-shadow,border-color]",
                              moduleDragSnapshot.isDragging && "border-[var(--course-focus-border)] shadow-[var(--app-shadow-soft)]",
                            )}
                          >
                            <div className={cn("flex items-center gap-1 px-1.5 py-1.5", !collapsed && "border-b border-[var(--course-line)]")}>
                              <span
                                {...moduleDragProvided.dragHandleProps}
                                aria-label={`Reorder module ${module.title}`}
                                className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-[var(--course-text-faint)] hover:bg-[var(--course-surface-muted)] hover:text-[var(--course-text-muted)] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-border)] disabled:cursor-not-allowed"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </span>
                              <button type="button" onClick={() => toggleModule(module.id)} aria-label={`${collapsed ? "Expand" : "Collapse"} ${module.title}`} className="flex h-8 w-7 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--course-surface-muted)]">
                                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-[var(--course-surface-muted)] px-1.5 font-mono text-[10px] font-semibold text-[var(--course-text-muted)]">{String(moduleIndex + 1).padStart(2, "0")}</span>
                              {editingModuleId === module.id ? (
                                <>
                                  <input autoFocus value={editingModuleTitle} onChange={(event) => setEditingModuleTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameModule(module); if (event.key === "Escape") setEditingModuleId(null); }} aria-label={`Module name for ${module.title}`} className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--course-focus-border)] bg-[var(--course-surface-muted)] px-2 text-xs font-semibold outline-none ring-2 ring-[var(--course-focus-ring)]" />
                                  <button type="button" onClick={() => void renameModule(module)} disabled={!editingModuleTitle.trim() || isMutating} aria-label="Save module name" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--course-surface-muted)] disabled:opacity-40"><Check className="h-3.5 w-3.5" /></button>
                                  <button type="button" onClick={() => setEditingModuleId(null)} disabled={isMutating} aria-label="Cancel module rename" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--course-surface-muted)] disabled:opacity-40"><X className="h-3.5 w-3.5" /></button>
                                </>
                              ) : (
                                <>
                                  <h3 className="min-w-0 flex-1 truncate text-xs font-semibold" title={module.title}>{module.title}</h3>
                                  <button type="button" onClick={() => { setEditingModuleId(module.id); setEditingModuleTitle(module.title); setEditingLessonId(null); }} disabled={isSaving || isMutating} aria-label={`Rename module ${module.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--course-surface-muted)] disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button type="button" onClick={() => setDeleteTarget({ type: "module", id: module.id, title: module.title })} disabled={isSaving || isMutating} aria-label={`Delete module ${module.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)] disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                                  <button type="button" onClick={() => { setLessonModuleId(module.id); setNewLessonTitle(""); setCollapsedModules((current) => { const next = new Set(current); next.delete(module.id); return next; }); }} disabled={isSaving || isMutating} aria-label={`Add lesson to ${module.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--course-surface-muted)] disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                                </>
                              )}
                            </div>

                            {!collapsed && (
                      <Droppable droppableId={module.id} type="LESSON">
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className={cn("space-y-0.5 p-1.5", snapshot.isDraggingOver && "bg-[var(--course-accent)]/35")}>
                            {module.lessons.map((lesson, lessonIndex) => (
                              <Draggable key={lesson.id} draggableId={lesson.id} index={lessonIndex} isDragDisabled={isSaving}>
                                {(dragProvided, dragSnapshot) => (
                                  <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={cn("group flex items-center gap-1 rounded-lg pr-1 transition-colors", activeLessonId === lesson.id ? "bg-[var(--course-accent)]" : "hover:bg-[var(--course-surface-muted)]", dragSnapshot.isDragging && "bg-[var(--app-surface)] shadow-lg")}>
                                    <span {...dragProvided.dragHandleProps} className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center text-[var(--course-text-faint)] opacity-50 group-hover:opacity-100"><GripVertical className="h-3.5 w-3.5" /></span>
                                    {editingLessonId === lesson.id ? (
                                      <>
                                        <input autoFocus value={editingLessonTitle} onChange={(event) => setEditingLessonTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameLesson(lesson, module.id); if (event.key === "Escape") setEditingLessonId(null); }} aria-label={`Lesson name for ${lesson.title}`} className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--course-focus-border)] bg-[var(--app-surface)] px-2 text-xs font-medium outline-none ring-2 ring-[var(--course-focus-ring)]" />
                                        <button type="button" onClick={() => void renameLesson(lesson, module.id)} disabled={!editingLessonTitle.trim() || isMutating} aria-label="Save lesson name" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--app-surface)] disabled:opacity-40"><Check className="h-3.5 w-3.5" /></button>
                                        <button type="button" onClick={() => setEditingLessonId(null)} disabled={isMutating} aria-label="Cancel lesson rename" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--app-surface)] disabled:opacity-40"><X className="h-3.5 w-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => onSelectLesson(lesson.id)} disabled={isSaving || isMutating} className="min-w-0 flex-1 py-2.5 text-left disabled:cursor-not-allowed">
                                          <span className="block truncate text-xs font-medium">{lesson.title}</span>
                                        </button>
                                        <button type="button" onClick={() => { setEditingLessonId(lesson.id); setEditingLessonTitle(lesson.title); setEditingModuleId(null); }} disabled={isSaving || isMutating} aria-label={`Rename lesson ${lesson.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--app-surface)] disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button type="button" onClick={() => setDeleteTarget({ type: "lesson", id: lesson.id, moduleId: module.id, title: lesson.title })} disabled={isSaving || isMutating} aria-label={`Delete lesson ${lesson.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)] disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                                        <button type="button" onClick={() => void togglePrerequisite(lesson, module.id)} disabled={isSaving || isMutating} aria-label={lesson.isLocked ? `Unlock ${lesson.title}` : `Lock ${lesson.title}`} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--app-surface)] disabled:opacity-40", lesson.isLocked && "text-[var(--course-focus-border)]")}>
                                          {lesson.isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}

                            {lessonModuleId === module.id && (
                              <div className="flex gap-1.5 pt-1">
                                <input autoFocus value={newLessonTitle} onChange={(event) => setNewLessonTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addLesson(module.id); if (event.key === "Escape") setLessonModuleId(null); }} placeholder="Lesson title" aria-label={`New lesson title for ${module.title}`} className="h-9 min-w-0 flex-1 rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-2.5 text-xs outline-none focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" />
                                <WorkspaceButton type="button" variant="primary" size="icon" onClick={() => void addLesson(module.id)} disabled={!newLessonTitle.trim()} aria-label="Add lesson"><Check className="h-3.5 w-3.5" /></WorkspaceButton>
                                <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => setLessonModuleId(null)} aria-label="Cancel new lesson"><X className="h-3.5 w-3.5" /></WorkspaceButton>
                              </div>
                            )}

                            {module.lessons.length === 0 && lessonModuleId !== module.id && (
                              <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => setLessonModuleId(module.id)} className="w-full"><Plus className="h-3.5 w-3.5" />Add the first lesson</WorkspaceButton>
                            )}
                          </div>
                        )}
                      </Droppable>
                            )}
                          </section>
                        )}
                      </Draggable>
                    );
                  })}
                  {moduleListProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !isMutating) setDeleteTarget(null); }}>
        <DialogContent className="course-dialog w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--course-line-strong)] bg-[var(--app-surface)] p-0 shadow-2xl">
          <div className="border-b border-[var(--course-line)] px-5 py-4 pr-12">
            <DialogTitle className="text-lg font-semibold text-[var(--course-text)]">Delete {deleteTarget?.type}?</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6 text-[var(--course-text-muted)]">
              {deleteTarget?.type === "module"
                ? `This will permanently delete “${deleteTarget.title}” and every lesson inside it.`
                : `This will permanently delete “${deleteTarget?.title}”.`} This cannot be undone.
            </DialogDescription>
          </div>
          <div className="flex justify-end gap-2 px-5 py-4">
            <WorkspaceButton type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isMutating}>Cancel</WorkspaceButton>
            <WorkspaceButton type="button" variant="danger" onClick={() => void deleteSyllabusItem()} disabled={isMutating}>
              {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{isMutating ? "Deleting..." : `Delete ${deleteTarget?.type ?? "item"}`}
            </WorkspaceButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
