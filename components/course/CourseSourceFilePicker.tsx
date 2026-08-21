"use client";

import { useRef } from "react";
import { FileText, Upload } from "lucide-react";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { cn } from "@/lib/utils";

type CourseSourceFilePickerProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  className?: string;
};

export function CourseSourceFilePicker({ file, onFileChange, accept = ".pdf,.doc,.docx,image/*", className }: CourseSourceFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={inputRef} type="file" accept={accept} onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} className="sr-only" />
      <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => inputRef.current?.click()} className={cn("max-w-full justify-start border-dashed", className)}>
        {file ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        <span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose a source file"}</span>
      </WorkspaceButton>
    </>
  );
}
