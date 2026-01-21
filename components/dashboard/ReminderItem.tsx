import { Bell } from "lucide-react";

interface ReminderItemProps {
  task: string;
  date: string;
  time: string;
}

export function ReminderItem({ task, date, time }: ReminderItemProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Bell className="h-4 w-4 text-[#262626] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#262626]">{task}</p>
        <p className="text-xs text-[#262626]">{date}</p>
        <p className="text-xs text-[#262626]">{time}</p>
      </div>
    </div>
  );
}
