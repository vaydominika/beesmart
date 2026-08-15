"use client";

import { useState } from "react";
import { FileText, Globe2, Image as ImageIcon, Lock, Mail, Paperclip, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Editor } from "@/components/ui/editor";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton, workspaceButtonVariants } from "@/components/ui/workspace-button";
import { CourseVisibility } from "@/lib/course-summary";
import { COURSE_TITLE_MAX_LENGTH } from "@/lib/course-title";
import { cn } from "@/lib/utils";

interface CreateCourseModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (course: { id: string }) => void;
}

type UploadedFile = { uploadId: string; fileName: string; detectedMime: string; fileType: string; fileSize: number; scanStatus: string; previewUrl: string };

const VISIBILITY_OPTIONS = [
  { value: "PRIVATE", label: "Private", hint: "Only you", icon: Lock },
  { value: "PUBLIC", label: "Public", hint: "Anyone can find it", icon: Globe2 },
  { value: "INVITATION_ONLY", label: "Invitation only", hint: "Only invited people", icon: Mail },
] as const;

export function CreateCourseModal({ open, onClose, onCreated }: CreateCourseModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverUploadId, setCoverUploadId] = useState("");
  const [visibility, setVisibility] = useState<CourseVisibility>("PRIVATE");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setTitle("");
    setDescription("");
    setCoverImageUrl("");
    setCoverUploadId("");
    setVisibility("PRIVATE");
    setFiles([]);
    setValidation(null);
  };

  const closeAndReset = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "COURSE_COVER");
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!response.ok) throw new Error();
      const uploaded = await response.json();
      setCoverImageUrl(uploaded.previewUrl);
      setCoverUploadId(uploaded.uploadId);
    } catch {
      toast.error("The cover image could not be uploaded.");
    } finally {
      setUploadingCover(false);
      event.target.value = "";
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles?.length) return;
    setUploadingFiles(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", "COURSE_ATTACHMENT");
        const response = await fetch("/api/uploads", { method: "POST", body: formData });
        if (!response.ok) {
          toast.error(`${file.name} could not be uploaded.`);
          continue;
        }
        const uploaded = await response.json();
        setFiles((current) => [...current, uploaded]);
      }
    } catch {
      toast.error("The selected files could not be uploaded.");
    } finally {
      setUploadingFiles(false);
      event.target.value = "";
    }
  };

  const continueToDetails = () => {
    if (!title.trim()) {
      setValidation("Enter a course title to continue.");
      return;
    }
    setValidation(null);
    setStep(2);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setStep(1);
      setValidation("Enter a course title to continue.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          coverUploadId: coverUploadId || null,
          uploadIds: files.map((file) => file.uploadId),
          visibility,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error ?? "The course could not be created.");
        return;
      }
      toast.success("Course created.");
      reset();
      onClose();
      onCreated(data);
    } catch {
      toast.error("The course could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) closeAndReset(); }}>
      <DialogContent className="course-dialog fixed bottom-0 left-0 top-auto flex max-h-[96dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-3xl border border-[var(--course-line-strong)] bg-[var(--app-surface)] p-0 shadow-2xl md:left-[50%] md:top-[50%] md:h-[min(96dvh,820px)] md:w-[calc(100vw-40px)] md:max-w-4xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl">
        <div className="border-b border-[var(--course-line)] px-5 py-3.5 pr-12 md:px-6">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-[var(--course-text-muted)]"><span>Step {step} of 2</span><span aria-hidden="true">·</span><span>{step === 1 ? "Basics" : "Details"}</span></div>
          <DialogTitle className="text-lg font-semibold text-[var(--course-text)]">Create course</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-[var(--course-text-muted)]">{step === 1 ? "Set the course identity and who can access it." : "Add context and optional learning materials."}</DialogDescription>
        </div>

        <div className="course-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3.5 md:px-6">
          {step === 1 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[var(--course-text-muted)]">Course title</span>
                <input autoFocus value={title} maxLength={COURSE_TITLE_MAX_LENGTH} onChange={(event) => { setTitle(event.target.value); if (validation) setValidation(null); }} placeholder="Introduction to biology" className="h-11 w-full rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-3 text-sm font-medium text-[var(--course-text)] outline-none placeholder:text-[var(--course-text-faint)] focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" />
              </label>
              {validation && <p role="alert" className="rounded-xl bg-[var(--course-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--course-danger)]">{validation}</p>}

              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-[var(--course-text-muted)]">Visibility <span className="font-normal text-[var(--course-text-faint)]">(you can change this later)</span></legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {VISIBILITY_OPTIONS.map(({ value, label, hint, icon: Icon }) => (
                    <button key={value} type="button" onClick={() => setVisibility(value)} aria-pressed={visibility === value} className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-border)]", visibility === value ? "border-[var(--course-focus-border)] bg-[var(--course-accent)]" : "border-[var(--course-line)] bg-[var(--app-surface)] hover:bg-[var(--course-surface-muted)]")}>
                      <Icon className="h-4 w-4 shrink-0" /><span><span className="block text-sm font-semibold text-[var(--course-text)]">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--course-text-muted)]">{hint}</span></span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-[var(--course-text-muted)]">Cover image <span className="font-normal">(optional)</span></span>
                <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--course-line-strong)] bg-[var(--course-surface-muted)] bg-cover bg-center lg:h-28" style={coverImageUrl ? { backgroundImage: `linear-gradient(var(--app-scrim-soft), var(--app-scrim-soft)), url(${JSON.stringify(coverImageUrl)})` } : undefined}>
                  {!coverImageUrl && <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--course-text-muted)]"><ImageIcon className="h-4 w-4" />{uploadingCover ? "Uploading…" : "Choose an image"}</span>}
                  <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploadingCover} aria-label="Upload course cover" className="absolute inset-0 cursor-pointer opacity-0" />
                  {coverImageUrl && <WorkspaceButton type="button" variant="secondary" size="icon-compact" onClick={() => { setCoverImageUrl(""); setCoverUploadId(""); }} aria-label="Remove cover image" className="absolute right-2 top-2"><X className="h-4 w-4" /></WorkspaceButton>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="course-description" className="mb-1.5 block text-xs font-semibold text-[var(--course-text-muted)]">Description <span className="font-normal">(optional)</span></label>
                <div className="min-h-36 rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] p-3 focus-within:border-[var(--course-focus-border)] focus-within:ring-2 focus-within:ring-[var(--course-focus-ring)] lg:min-h-48">
                  <Editor id="course-description" initialValue={description} onChange={setDescription} placeholder="Describe what learners will study…" className="min-h-24 lg:min-h-36" />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold text-[var(--course-text-muted)]">Course materials <span className="font-normal">(optional)</span></p><p className="mt-0.5 text-[11px] text-[var(--course-text-faint)]">PDFs, images, audio, video, or documents</p></div>
                  <label className={workspaceButtonVariants({ variant: "secondary", size: "compact", className: "cursor-pointer" })}><Upload className="h-3.5 w-3.5" />{uploadingFiles ? "Uploading…" : "Attach files"}<input type="file" multiple onChange={handleFileUpload} disabled={uploadingFiles} className="sr-only" /></label>
                </div>
                {files.length ? (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={file.uploadId} className="flex items-center gap-3 rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] p-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface)]"><FileText className="h-4 w-4 text-[var(--course-text-muted)]" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[var(--course-text)]">{file.fileName}</span><span className="text-[10px] text-[var(--course-text-faint)]">{Math.max(0.1, file.fileSize / 1024).toFixed(1)} KB</span></span>
                        <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.fileName}`}><X className="h-4 w-4" /></WorkspaceButton>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--course-line)] bg-[var(--course-surface-muted)] text-center lg:min-h-24"><Paperclip className="mb-2 h-5 w-5 text-[var(--course-text-faint)]" /><p className="text-xs font-medium text-[var(--course-text-muted)]">No materials attached</p></div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-[var(--course-line)] bg-[var(--app-surface)] px-5 py-3.5 md:px-6">
          {step === 1 ? <WorkspaceButton type="button" variant="secondary" onClick={closeAndReset} className="flex-1">Cancel</WorkspaceButton> : <WorkspaceButton type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">Back</WorkspaceButton>}
          {step === 1 ? <WorkspaceButton type="button" variant="primary" onClick={continueToDetails} className="flex-1">Continue</WorkspaceButton> : <WorkspaceButton type="button" variant="primary" onClick={() => void handleSave()} disabled={saving || uploadingFiles} className="flex-1">{saving ? "Creating…" : "Create course"}</WorkspaceButton>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
