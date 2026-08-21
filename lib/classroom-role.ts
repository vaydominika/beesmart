export const CLASSROOM_STAFF_ROLES = ["TEACHER", "TEACHING_ASSISTANT"] as const;

export function isClassroomStaffRole(role: string): boolean {
  return CLASSROOM_STAFF_ROLES.includes(role as (typeof CLASSROOM_STAFF_ROLES)[number]);
}
