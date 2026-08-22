import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/security/rate-limit";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  requestClientAddress: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
}));

vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-password") } }));

const registration = (body: unknown) => new Request("http://localhost/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, limit: 5, remaining: 4, retryAfterSeconds: 0 });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as never);
  });

  it("rejects invalid email and weak passwords before accessing the database", async () => {
    const response = await POST(registration({ name: "Ada", email: "not-an-email", password: "short" }));
    expect(response.status).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 429 when registration is throttled", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({ allowed: false, limit: 5, remaining: 0, retryAfterSeconds: 60 });
    const response = await POST(registration({ name: "Ada", email: "ada@example.com", password: "correct-horse-battery" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("does not reveal whether an account already exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as never);
    const response = await POST(registration({ name: "Ada", email: "ada@example.com", password: "correct-horse-battery" }));
    expect(await response.json()).toEqual({ error: "Unable to create an account with these details" });
  });

  it("normalizes and creates a valid account", async () => {
    const response = await POST(registration({ name: "  Ada  ", email: "ADA@EXAMPLE.COM", password: "correct-horse-battery" }));
    expect(response.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith({ data: { name: "Ada", email: "ada@example.com", password: "hashed-password" } });
  });
});
