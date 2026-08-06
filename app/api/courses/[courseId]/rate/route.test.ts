import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    courseEnrollment: { findUnique: vi.fn() },
    courseProgress: { findFirst: vi.fn() },
    courseRating: { findUnique: vi.fn(), aggregate: vi.fn(), upsert: vi.fn() },
  },
}));

const context = { params: Promise.resolve({ courseId: "course-1" }) };
const request = (body: unknown) => new NextRequest("http://localhost/api/courses/course-1/rate", { method: "POST", body: JSON.stringify(body) });

describe("course ratings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("learner-1");
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1", createdById: "teacher-1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "learner-1" } as never);
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({ completedAt: new Date() } as never);
    vi.mocked(prisma.courseProgress.findFirst).mockResolvedValue({ id: "progress-1" } as never);
    vi.mocked(prisma.courseRating.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.courseRating.aggregate).mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } } as never);
    vi.mocked(prisma.courseRating.upsert).mockResolvedValue({ id: "rating-1" } as never);
  });

  it("returns the learner's rating and aggregate", async () => {
    vi.mocked(prisma.courseRating.findUnique).mockResolvedValue({ rating: 4, comment: "Useful" } as never);
    const data = await (await GET(new NextRequest("http://localhost/api/courses/course-1/rate"), context)).json();
    expect(data.currentRating).toEqual({ rating: 4, comment: "Useful" });
    expect(data.averageRating).toBe(4.5);
    expect(data.ratingCount).toBe(2);
  });

  it("rejects non-integer and out-of-range ratings", async () => {
    expect((await POST(request({ rating: 4.5 }), context)).status).toBe(400);
    expect((await POST(request({ rating: 6 }), context)).status).toBe(400);
  });

  it("prevents creators from rating their own course", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1", createdById: "learner-1" } as never);
    expect((await POST(request({ rating: 5 }), context)).status).toBe(403);
  });

  it("requires the learner to start before adding a rating", async () => {
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({ completedAt: null } as never);
    vi.mocked(prisma.courseProgress.findFirst).mockResolvedValue(null);
    expect((await POST(request({ rating: 5 }), context)).status).toBe(403);
    expect(prisma.courseRating.upsert).not.toHaveBeenCalled();
  });

  it("allows a learner who has started the course to rate it", async () => {
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({ completedAt: null } as never);
    const response = await POST(request({ rating: 5 }), context);
    expect(response.status).toBe(200);
  });

  it("allows an existing rating to be edited after completion state changes", async () => {
    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({ completedAt: null } as never);
    vi.mocked(prisma.courseRating.findUnique).mockResolvedValue({ id: "rating-1" } as never);
    const response = await POST(request({ rating: 3, comment: "Updated" }), context);
    expect(response.status).toBe(200);
    expect(prisma.courseRating.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { rating: 3, comment: "Updated" } }));
  });
});
