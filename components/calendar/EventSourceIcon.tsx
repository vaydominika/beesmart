import { BookOpen, School, UserRound } from "lucide-react";
import type { ScheduleEvent } from "@/lib/schedule";

export function EventSourceIcon({ source, className = "h-3.5 w-3.5" }: { source: ScheduleEvent["source"]; className?: string }) {
  const Icon = source === "classroom" ? School : source === "course" ? BookOpen : UserRound;
  return <Icon className={className} aria-hidden="true" />;
}
