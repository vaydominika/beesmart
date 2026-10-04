"use client";

import { useText } from "@/i18n/use-text";

import { School } from "lucide-react";
import { WorkspaceSelect } from "@/components/ui/workspace-select";

export interface ClassroomDestination {
  id: string;
  name: string;
}

interface ClassroomDestinationSelectProps {
  classrooms: ClassroomDestination[];
  value: string;
  onChange: (classroomId: string) => void;
}

export function ClassroomDestinationSelect({ classrooms, value, onChange }: ClassroomDestinationSelectProps) {
  const t = useText();
  const disabled = classrooms.length === 0;

  return (
    <WorkspaceSelect
      ariaLabel={t("Destination classroom")}
      value={value}
      options={classrooms.map((classroom) => ({ value: classroom.id, label: classroom.name, icon: School }))}
      onValueChange={onChange}
      triggerIcon={School}
      disabled={disabled}
      placeholder={disabled ? t("No classrooms available") : t("Choose a classroom")}
      className="h-10 w-full bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface)]"
      contentClassName="min-w-52"
    />
  );
}
