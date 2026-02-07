import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon } from '@hugeicons/core-free-icons';
import { cn } from "@/lib/utils";
import Image from "next/image";

interface LearningCardProps {
  title: string;
  description: string;
  progress?: number;
  className?: string;
  showButton?: boolean;
  onButtonClick?: () => void;
}

export function LearningCard({
  title,
  description,
  progress,
  className,
  onButtonClick,
}: LearningCardProps) {
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
              src="/images/LearningCardImage.jpg" 
              alt={title} 
              fill
              className="object-cover"
              style={{ objectPosition: "50% 65%" }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute top-2 right-2 z-10">
              <FancyButton
                className="p-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onButtonClick?.();
                }}
              >
                <HugeiconsIcon icon={PlayIcon} className="size-8 text-(--theme-text)" strokeWidth={2.5}/>
              </FancyButton>
            </div>
          </div>
          <div className="p-2 pb-4 flex-1 flex flex-col min-h-0 relative">
            <div className="flex-1 min-h-[55px] max-h-[60px] overflow-hidden">
              <h3 className="font-semibold text-(--theme-text) mb-1">{title}</h3>
              <p className="text-sm text-(--theme-text) mb-2">{description}</p>
            </div>
            {progress !== undefined && (
              <div className="pt-2 shrink-0 relative">
                <span 
                  className="absolute text-xs font-medium text-(--theme-secondary) top-0 whitespace-nowrap transform -translate-x-1/2"
                  style={{ left: `${progress}%` }}
                >
                  {progress}%
                </span>
                <div className="w-full bg-(--theme-bg) h-2 rounded-full corner-superellipse mt-2">
                  <div
                    className="bg-(--theme-secondary) h-2 transition-all rounded-full corner-superellipse"
                    style={{ width: `${progress}%` }}
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