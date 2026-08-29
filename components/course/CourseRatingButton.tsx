"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { CourseRatingModal } from "@/components/course/CourseRatingModal";
import { WorkspaceButton } from "@/components/ui/workspace-button";

export function CourseRatingButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => setOpen(true)}>
        <Star className="h-4 w-4" /> Rate course
      </WorkspaceButton>
      <CourseRatingModal open={open} onOpenChange={setOpen} courseId={courseId} />
    </>
  );
}
