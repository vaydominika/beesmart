import { HugeiconsIcon } from '@hugeicons/react';
import { Notification01Icon } from '@hugeicons/core-free-icons';

interface ReminderItemProps {
  task: string;
  date: string;
  time: string;
}

export function ReminderItem({ task, date, time }: ReminderItemProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      {/* Bell icon in rounded white square */}
      <div className="shrink-0 w-12 h-12 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center">
        <HugeiconsIcon icon={Notification01Icon} className="h-6 w-6 md:h-5 md:w-5 text-(--theme-text)" strokeWidth={2} />
      </div>
      {/* Title + date */}
      <div className="flex-1 min-w-0">
        <p className="text-base md:text-sm font-bold text-(--theme-text) truncate">{task}</p>
        <p className="text-sm md:text-xs text-(--theme-text) opacity-60">{date}</p>
      </div>
      {/* Time on the right */}
      {time && (
        <span className="shrink-0 text-base md:text-sm font-medium text-(--theme-text) opacity-60">
          {time}
        </span>
      )}
    </div>
  );
}
