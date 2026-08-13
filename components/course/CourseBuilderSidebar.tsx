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
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import type { CourseBuilderCourse, CourseBuilderLesson, CourseBuilderModule } from "@/lib/course-builder";
import { lessonCount, reorderModules } from "@/lib/course-builder";
import { cn } from "@/lib/utils";

interface CourseBuilderSidebarProps {
  course: CourseBuilderCourse;
  onCourseChange: (course: Partial<CourseBuilderCourse>) => void;
  activeLessonId: string | null;
  onSelectLesson: (id: string) => void;
  isSaving?: boolean;
}

type GeneratedOutline = {
  modules: Array<{ title: string; description?: string; lessons: Array<{ title: string; description?: string }> }>;
};

export default function CourseBuilderSidebar({ course, onCourseChange, activeLessonId, onSelectLesson, isSaving = false }: CourseBuilderSidebarProps) {
  const [isAIExpanded, setIsAIExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [newModuleOpen, setNewModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <WorkspaceButton type="button" variant={isAIExpanded ? "primary" : "secondary"} size="icon" onClick={() => setIsAIExpanded((current) => !current)} disabled={isSaving} aria-label="Generate syllabus with AI" aria-expanded={isAIExpanded}>
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
              <div><p className="text-xs font-semibold">Create an outline</p><p className="mt-1 text-[11px] leading-4 text-[var(--course-text-muted)]">Paste notes or add a file to build a syllabus.</p></div>
              <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => { setIsAIExpanded(false); setSelectedFile(null); setSourceText(""); }} aria-label="Close outline generator"><X className="h-3.5 w-3.5" /></WorkspaceButton>
            </div>
            <label htmlFor="outline-source-text" className="mt-3 block text-[10px] font-semibold text-[var(--course-text-muted)]">Source text</label>
            <textarea
              id="outline-source-text"
              aria-label="Outline source text"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Paste notes, lesson ideas, or source material..."
              rows={4}
              className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-[var(--course-line)] bg-[color-mix(in_srgb,var(--app-surface)_80%,transparent)] px-3 py-2.5 text-xs leading-5 outline-none placeholder:text-[var(--course-text-faint)] focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]"
            />
            <div className="my-2.5 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--course-text-faint)]" aria-hidden="true"><span className="h-px flex-1 bg-[var(--course-line)]" /><span>or add a file</span><span className="h-px flex-1 bg-[var(--course-line)]" /></div>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="sr-only" />
            <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => fileInputRef.current?.click()} className="w-full justify-start border-dashed">
              {selectedFile ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}<span className="min-w-0 flex-1 truncate">{selectedFile?.name ?? "Choose a source file"}</span>
            </WorkspaceButton>
            <WorkspaceButton type="button" variant="primary" size="compact" onClick={() => void handleBulkGenerate()} disabled={(!selectedFile && !sourceText.trim()) || isGenerating} className="mt-2 w-full">
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
                              <h3 className="min-w-0 flex-1 truncate text-xs font-semibold" title={module.title}>{module.title}</h3>
                              <button type="button" onClick={() => { setLessonModuleId(module.id); setNewLessonTitle(""); setCollapsedModules((current) => { const next = new Set(current); next.delete(module.id); return next; }); }} disabled={isSaving} aria-label={`Add lesson to ${module.title}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--course-text-muted)] hover:bg-[var(--course-surface-muted)] disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
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
                                    <button type="button" onClick={() => onSelectLesson(lesson.id)} disabled={isSaving} className="min-w-0 flex-1 py-2.5 text-left disabled:cursor-not-allowed">
                                      <span className="block truncate text-xs font-medium">{lesson.title}</span>
                                    </button>
                                    <button type="button" onClick={() => void togglePrerequisite(lesson, module.id)} aria-label={lesson.isLocked ? `Unlock ${lesson.title}` : `Lock ${lesson.title}`} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-0 hover:bg-[var(--app-surface)] group-hover:opacity-100 focus:opacity-100", lesson.isLocked && "text-[var(--course-focus-border)] opacity-100")}>
                                      {lesson.isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                                    </button>
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
    </div>
  );
}
