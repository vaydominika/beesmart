import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const PLACEHOLDER_IMAGE = "/images/LearningCardImage.jpg";

interface LearningCardProps {
  id: string;
  title: string;
  description: string;
  progress?: number;
  coverImageUrl?: string | null;
  averageRating?: number | null;
  className?: string;
  showButton?: boolean;
  onButtonClick?: () => void;
  onReportClick?: (courseId: string) => void;
}

function StarRating({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: full }, (_, i) => (
        <span key={`f-${i}`} className="text-(--theme-secondary) text-sm">★</span>
      ))}
      {half ? <span className="text-(--theme-secondary) text-sm opacity-70">★</span> : null}
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e-${i}`} className="text-(--theme-text) text-sm opacity-40">★</span>
      ))}
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
  onButtonClick,
  onReportClick,
}: LearningCardProps) {
  const imageSrc =
    coverImageUrl && coverImageUrl.trim() !== ""
      ? coverImageUrl
      : PLACEHOLDER_IMAGE;

  return (
    <div className="h-full flex flex-col">
      <FancyCard
        className={cn(
          "flex-1 flex flex-col relative overflow-hidden",
          className
        )}
      >
        <div
          className="absolute inset-0 bg-cover translate-y-1/2 bg-center opacity-5 pointer-events-none"
          style={{ backgroundImage: "url('/svg/CardBackground.svg')" }}
        />
        <div className="relative z-10 flex flex-col h-full">
          <div className="relative w-full h-48 overflow-hidden rounded-t-xl corner-squircle shrink-0">
            <Image
              src={imageSrc}
              alt={title}
              fill
              className="object-cover"
              style={{ objectPosition: "50% 65%" }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized={imageSrc.startsWith("http")}
            />
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              {onReportClick && (
                <FancyButton
                  className="p-0 cursor-pointer size-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReportClick(id);
                  }}
                  aria-label="Report course"
                >
                  <Flag
                    className="size-7 text-(--theme-text)"
                    strokeWidth={2.5}
                  />
                </FancyButton>
              )}
              <FancyButton
                className="p-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onButtonClick?.();
                }}
              >
                <HugeiconsIcon
                  icon={PlayIcon}
                  className="size-8 text-(--theme-text)"
                  strokeWidth={2.5}
                />
              </FancyButton>
            </div>
          </div>
          <div className="p-2 pb-4 flex-1 flex flex-col min-h-0 relative">
            <div className="flex-1 min-h-[55px] max-h-[60px] overflow-hidden">
              <h3 className="font-semibold text-(--theme-text) mb-1">{title}</h3>
              <p className="text-sm text-(--theme-text) mb-2 line-clamp-2">
                {description ?? ""}
              </p>
            </div>
            {averageRating != null && averageRating > 0 && (
              <div className="mb-1">
                <StarRating value={Math.round(averageRating * 2) / 2} />
              </div>
            )}
            {progress !== undefined && (
              <div className="pt-2 shrink-0 relative">
                <span
                  className="absolute text-xs font-medium text-(--theme-secondary) top-0 whitespace-nowrap transform -translate-x-1/2"
                  style={{ left: `${Math.min(100, progress)}%` }}
                >
                  {progress}%
                </span>
                <div className="w-full bg-(--theme-bg) h-2 rounded-full corner-superellipse mt-2">
                  <div
                    className="bg-(--theme-secondary) h-2 transition-all rounded-full corner-superellipse"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </FancyCard>
    </div>
  );
}
