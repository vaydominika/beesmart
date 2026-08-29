import { Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FileAttachmentChipProps = {
  name: string;
  href?: string;
  size?: number;
  onRemove?: () => void;
  className?: string;
};

export function FileAttachmentChip({ name, href, size, onRemove, className }: FileAttachmentChipProps) {
  const content = <><Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{name}</span>{size != null ? <span className="text-[10px] text-[var(--app-text-faint)]">{Math.max(0.1, size / 1024).toFixed(1)} KB</span> : null}</>;
  const sharedClassName = cn("flex min-w-0 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs font-medium text-[var(--app-text-muted)]", className);
  return (
    <div className="flex min-w-0 items-center gap-1">
      {href ? <a href={href} target="_blank" rel="noreferrer" className={cn(sharedClassName, "hover:text-[var(--app-text)]")}>{content}</a> : <div className={sharedClassName}>{content}</div>}
      {onRemove ? <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"><X className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
    </div>
  );
}
