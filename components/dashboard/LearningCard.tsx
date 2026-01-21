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
        "bg-[#FADA6D] hover:bg-[#FADA6D]/90 transition-colors cursor-pointer p-4 h-full rounded-lg",
        className
      )}
    >
      <h3 className="font-semibold text-[#262626] mb-1">{title}</h3>
      <p className="text-sm text-[#262626] mb-2">{description}</p>
      {progress !== undefined && (
        <div className="mt-2">
          <div className="w-full bg-[#262626]/10 rounded-full h-2">
            <div
              className="bg-[#262626]/30 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
