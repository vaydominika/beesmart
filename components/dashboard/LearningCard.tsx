import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";
import { Flag, Star } from "lucide-react";
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
  buttonText?: string;
  onButtonClick?: () => void;
  onReportClick?: (courseId: string) => void;
  onRateClick?: (courseId: string) => void;
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${value} out of 5 stars`}>
      <Star className="h-4 w-4 fill-(--theme-secondary) text-(--theme-secondary)" aria-hidden="true" />
      <span className="text-xs font-semibold text-(--theme-text)">{value.toFixed(1)}</span>
      <span className="text-[10px] font-medium text-(--theme-text) opacity-55">/ 5</span>
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
  buttonText,
  onButtonClick,
  onReportClick,
  onRateClick,
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
              {onRateClick && (
                <FancyButton className="p-0 cursor-pointer size-9" onClick={(event) => { event.stopPropagation(); onRateClick(id); }} aria-label="Rate course">
                  <Star className="size-6 text-(--theme-text)" strokeWidth={2.5} />
                </FancyButton>
              )}
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
                className={cn("cursor-pointer", buttonText ? "px-3 py-2 flex items-center gap-2" : "p-0")}
                onClick={(e) => {
                  e.stopPropagation();
                  onButtonClick?.();
                }}
              >
                {buttonText ? (
                  <span className="text-xs font-bold uppercase tracking-wider text-(--theme-text)">{buttonText}</span>
                ) : (
                  <HugeiconsIcon
                    icon={PlayIcon}
                    className="size-8 text-(--theme-text)"
                    strokeWidth={2.5}
                  />
                )}
              </FancyButton>
            </div>
          </div>
          <div className="p-2 pb-4 flex-1 flex flex-col min-h-0 relative">
            <div className="flex-1 min-h-[55px] max-h-[60px] overflow-hidden">
              <h3 className="font-semibold text-(--theme-text) mb-1">{title}</h3>
              <div
                className="text-sm text-(--theme-text) mb-2 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: description ?? "" }}
              />
            </div>
            <div className="mb-1 min-h-5">
              {averageRating != null && averageRating > 0
                ? <StarRating value={Math.round(averageRating * 10) / 10} />
                : <span className="text-xs font-medium text-(--theme-text) opacity-55">No ratings yet</span>}
            </div>
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
