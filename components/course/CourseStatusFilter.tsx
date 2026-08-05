"use client";

import { CircleCheck, CircleDashed, Clock3, CloudUpload, FilePenLine, ListFilter, SlidersHorizontal } from "lucide-react";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import type { CourseTab, CreatedStatus, LearningStatus } from "@/lib/course-summary";

interface CourseStatusFilterProps {
  activeTab: CourseTab;
  learningFilter: LearningStatus;
  createdFilter: CreatedStatus;
  onLearningChange: (value: LearningStatus) => void;
  onCreatedChange: (value: CreatedStatus) => void;
}

const LEARNING_OPTIONS = [
  { value: "all", label: "All progress", icon: ListFilter },
  { value: "not-started", label: "Not started", icon: CircleDashed },
  { value: "in-progress", label: "In progress", icon: Clock3 },
  { value: "completed", label: "Completed", icon: CircleCheck },
] satisfies Array<{ value: LearningStatus; label: string; icon: typeof ListFilter }>;

const CREATED_OPTIONS = [
  { value: "all", label: "All courses", icon: ListFilter },
  { value: "draft", label: "Drafts", icon: FilePenLine },
  { value: "published", label: "Published", icon: CloudUpload },
] satisfies Array<{ value: CreatedStatus; label: string; icon: typeof ListFilter }>;

export function CourseStatusFilter({ activeTab, learningFilter, createdFilter, onLearningChange, onCreatedChange }: CourseStatusFilterProps) {
  const isLearning = activeTab === "learning";
  const options = isLearning ? LEARNING_OPTIONS : CREATED_OPTIONS;
  const value = isLearning ? learningFilter : createdFilter;

  const changeValue = (nextValue: string) => {
    if (isLearning) onLearningChange(nextValue as LearningStatus);
    else onCreatedChange(nextValue as CreatedStatus);
  };

  return (
    <WorkspaceSelect
      ariaLabel={isLearning ? "Learning status" : "Publishing status"}
      value={value}
      options={options}
      onValueChange={changeValue}
      triggerIcon={SlidersHorizontal}
      align="end"
      className="w-full font-semibold sm:min-w-36 sm:w-auto"
      contentClassName="w-48"
    />
  );
}
