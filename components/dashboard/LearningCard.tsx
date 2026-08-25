import { Flag, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { plainTextExcerpt } from "@/lib/course-summary";
import { WorkspaceProgress } from "@/components/ui/workspace-progress";

const PLACEHOLDER_IMAGE = "/images/LearningCardImage.jpg";

interface LearningCardProps {
  id: string;
  title: string;
  description: string;
  progress?: number;
  coverImageUrl?: string | null;
  averageRating?: number | null;
  className?: string;
  actionLabel?: "Edit" | "Continue" | "Open" | "Review";
  onButtonClick?: () => void;
  onReportClick?: (courseId: string) => void;
  onRateClick?: (courseId: string) => void;
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${value} out of 5 stars`}>
      <Star className="h-4 w-4 fill-[var(--dashboard-focus-border)] text-[var(--dashboard-focus-border)]" aria-hidden="true" />
      <span className="text-xs font-semibold text-[var(--dashboard-text)]">{value.toFixed(1)}</span>
      <span className="text-[10px] font-medium text-[var(--dashboard-text-faint)]">/ 5</span>
    </div>
  );
}

export function LearningCard({
  id,
  title,
  description,
  progress,
  coverImageUrl,
  averageRating,
  className,
  actionLabel = "Open",
  onButtonClick,
  onReportClick,
  onRateClick,
}: LearningCardProps) {
  const imageSrc =
    coverImageUrl && coverImageUrl.trim() !== ""
      ? coverImageUrl
      : PLACEHOLDER_IMAGE;

  const descriptionText = plainTextExcerpt(description);
  const normalizedProgress = Math.max(0, Math.min(100, progress ?? 0));

  return (
      <article
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] transition-colors hover:border-[var(--dashboard-line-strong)] hover:bg-[var(--dashboard-surface-hover)]",
          className,
        )}
      >
          <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[var(--dashboard-surface-muted)]">
            <Image
              src={imageSrc}
              alt={title}
              fill
              className="object-cover"
              style={{ objectPosition: "50% 65%" }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized={imageSrc.startsWith("http")}
            />
            <div className="absolute right-2 top-2 z-10 flex gap-1.5">
              {onRateClick && (
                <WorkspaceButton type="button" variant="secondary" size="icon-compact" className="border-[color-mix(in_srgb,var(--app-surface)_80%,transparent)] bg-[color-mix(in_srgb,var(--app-surface)_95%,transparent)]" onClick={(event) => { event.stopPropagation(); onRateClick(id); }} aria-label="Rate course">
                  <Star className="h-4 w-4" />
                </WorkspaceButton>
              )}
              {onReportClick && (
                <WorkspaceButton
                  type="button"
                  variant="secondary"
                  size="icon-compact"
                  className="border-[color-mix(in_srgb,var(--app-surface)_80%,transparent)] bg-[color-mix(in_srgb,var(--app-surface)_95%,transparent)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReportClick(id);
                  }}
                  aria-label="Report course"
                >
                  <Flag className="h-4 w-4" />
                </WorkspaceButton>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div>
              <h3 className="line-clamp-2 text-lg font-semibold leading-tight tracking-[-0.02em] text-[var(--dashboard-text)]">{title}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--dashboard-text-muted)]">
                {descriptionText || "No description"}
              </p>
            </div>
            <div className="mt-2 flex h-5 items-center">
              {averageRating != null && averageRating > 0
                ? <StarRating value={Math.round(averageRating * 10) / 10} />
                : <span className="text-xs font-medium leading-none text-[var(--dashboard-text-faint)]">No ratings yet</span>}
            </div>
            {progress !== undefined && <WorkspaceProgress value={normalizedProgress} className="mt-3 shrink-0" />}
            <div className="mt-3 flex justify-end border-t border-[var(--dashboard-line)] pt-3">
              <WorkspaceButton type="button" variant="primary" size="compact" onClick={onButtonClick}>
                {actionLabel}
              </WorkspaceButton>
            </div>
          </div>
      </article>
  );
}
