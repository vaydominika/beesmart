import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TicketAttachment = { storedFile: { id: string; originalName: string } };

export function TicketAttachmentGallery({ attachments, label = "Attachments", className, gridClassName }: { attachments: TicketAttachment[]; label?: string; className?: string; gridClassName?: string }) {
  if (!attachments.length) return null;
  return (
    <div className={cn("mt-4", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--app-text-muted)]"><ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />{label}</p>
      <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4", gridClassName)}>
        {attachments.map(({ storedFile }) => (
          <a key={storedFile.id} href={`/api/files/${storedFile.id}`} target="_blank" rel="noreferrer" className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]">
            <Image src={`/api/files/${storedFile.id}`} alt={storedFile.originalName} fill unoptimized className="object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none" />
          </a>
        ))}
      </div>
    </div>
  );
}
