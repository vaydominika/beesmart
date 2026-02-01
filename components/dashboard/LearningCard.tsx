import { FancyCard } from "@/components/fancycard";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface LearningCardProps {
  title: string;
  description: string;
  progress?: number;
  className?: string;
}

export function LearningCard({
  title,
  description,
  progress,
  className,
}: LearningCardProps) {
  return (
    <FancyCard
      className={cn(
        "hover:opacity-90 transition-opacity cursor-pointer h-full",
        className
      )}
    >
      <div className="relative w-full h-48 overflow-hidden">
        <Image 
          src="/images/LearningCardImage.jpg" 
          alt={title} 
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-(--theme-text) mb-1">{title}</h3>
        <p className="text-sm text-(--theme-text) mb-2">{description}</p>
        {progress !== undefined && (
          <div className="mt-2">
            <div className="w-full bg-(--theme-text)/10 h-2">
              <div
                className="bg-(--theme-text)/30 h-2 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </FancyCard>
  );
}