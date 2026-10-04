"use client";

import { useText } from "@/i18n/use-text";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { isClassroomStaffRole } from "@/lib/classroom-role";

export type ClassroomDetailSummary = { id: string; name: string; role: string };

export function useClassroomDetail(classroomId: string) {
  const t = useText();
  const router = useRouter();
  const [classroom, setClassroom] = useState<ClassroomDetailSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}`);
      if (!response.ok) {
        toast.error(t("Classroom not found."));
        router.push("/classroom");
        return;
      }
      setClassroom(await response.json());
    } catch {
      toast.error(t("Failed to load classroom."));
      router.push("/classroom");
    } finally {
      setLoading(false);
    }
  }, [classroomId, router, t]);

  useEffect(() => { void refetch(); }, [refetch]);

  return { classroom, loading, isStaff: classroom ? isClassroomStaffRole(classroom.role) : false, refetch };
}
