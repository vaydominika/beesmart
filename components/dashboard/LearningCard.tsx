import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card
      className={cn(
        "bg-[var(--theme-card)] hover:bg-[var(--theme-card)]/90 transition-colors cursor-pointer p-4 h-full rounded-lg",
        className
      )}
    >
      <h3 className="font-semibold text-[var(--theme-text)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--theme-text)] mb-2">{description}</p>
      {progress !== undefined && (
        <div className="mt-2">
          <div className="w-full bg-[var(--theme-text)]/10 rounded-full h-2">
            <div
              className="bg-[var(--theme-text)]/30 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
