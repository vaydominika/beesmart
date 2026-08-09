import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicProfile } from "./public-profile";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: vi.fn() }, course: { findMany: vi.fn() }, activityRecord: { findMany: vi.fn() }, classroomMember: { findMany: vi.fn() },
  classroomPost: { findMany: vi.fn() },
} }));

describe("getPublicProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not expose a private profile to another user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-2", name: "Private learner", avatar: null, image: null, bannerImageUrl: null, createdAt: new Date(), settings: { profileVisibility: "PRIVATE", activitySharing: true } } as never);
    const result = await getPublicProfile("user-2", "user-1");
    expect(result).toEqual({ status: "private", user: { id: "user-2", name: "Private learner" } });
    expect(prisma.course.findMany).not.toHaveBeenCalled();
  });

  it("omits activity when sharing is disabled", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-2", name: "Learner", avatar: null, image: null, bannerImageUrl: null, createdAt: new Date("2026-01-01"), settings: { profileVisibility: "PUBLIC", activitySharing: false } } as never);
    vi.mocked(prisma.course.findMany).mockResolvedValue([] as never);
    const result = await getPublicProfile("user-2", "user-1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.profile.activity).toEqual([]);
    expect(prisma.activityRecord.findMany).not.toHaveBeenCalled();
  });

  it("links classroom activities to their feed posts", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-2", name: "Teacher", avatar: null, image: null, bannerImageUrl: null, createdAt: new Date("2026-01-01"), settings: { profileVisibility: "PUBLIC", activitySharing: true } } as never);
    vi.mocked(prisma.course.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.activityRecord.findMany).mockResolvedValue([
      { id: "activity-post", activityType: "CLASSROOM_POST_PUBLISHED", courseId: null, classroomId: "classroom-1", relatedId: "post-1", createdAt: new Date("2026-08-01") },
      { id: "activity-test", activityType: "TEST_CREATED", courseId: null, classroomId: "classroom-1", relatedId: "test-1", createdAt: new Date("2026-08-02") },
      { id: "activity-deleted-post", activityType: "CLASSROOM_POST_PUBLISHED", courseId: null, classroomId: "classroom-1", relatedId: "deleted-post", createdAt: new Date("2026-08-03") },
    ] as never);
    vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([
      { classroomId: "classroom-1", classroom: { name: "Mathematics" } },
    ] as never);
    vi.mocked(prisma.classroomPost.findMany).mockResolvedValue([
      { id: "post-1", classroomId: "classroom-1", assignmentId: null, testId: null, courseId: null },
      { id: "post-for-test", classroomId: "classroom-1", assignmentId: null, testId: "test-1", courseId: null },
    ] as never);

    const result = await getPublicProfile("user-2", "user-1");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.profile.activity.map((item) => item.actionUrl)).toEqual([
      "/classroom/classroom-1?post=post-1#classroom-post-post-1",
      "/classroom/classroom-1?post=post-for-test#classroom-post-post-for-test",
    ]);
  });
});
