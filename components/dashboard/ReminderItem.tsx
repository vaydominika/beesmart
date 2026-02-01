import { Bell } from "lucide-react";

interface ReminderItemProps {
  task: string;
  date: string;
  time: string;
}

export function ReminderItem({ task, date, time }: ReminderItemProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Bell className="h-4 w-4 text-(--theme-text) mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-(--theme-text)">{task}</p>
        <p className="text-xs text-(--theme-text)">{date}</p>
        <p className="text-xs text-(--theme-text)">{time}</p>
      </div>
    </div>
  );
}
