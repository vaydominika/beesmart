import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  requestClientAddress: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
}));

const request = (email: string) => new Request("http://localhost/api/auth/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "https://beesmart.example");
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, limit: 3, remaining: 2, retryAfterSeconds: 0 });
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
    vi.mocked(prisma.verificationToken.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.verificationToken.create).mockResolvedValue({} as never);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
  });

  it("returns the same response for an unknown account without sending email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const response = await POST(request("missing@example.com"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "If an account exists for that email, a reset link has been sent." });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stores a hashed expiring token and emails the plain reset link", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", email: "ada@example.com" } as never);
    const response = await POST(request(" ADA@EXAMPLE.COM "));
    expect(response.status).toBe(200);
    expect(prisma.verificationToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      identifier: "password-reset:user-1",
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
      expires: expect.any(Date),
    }) });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "ada@example.com",
      resetUrl: expect.stringMatching(/^https:\/\/beesmart\.example\/reset-password\?token=/),
    }));
  });

  it("removes an unusable token when Resend delivery fails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", email: "ada@example.com" } as never);
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(new Error("delivery failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request("ada@example.com"));
    expect(response.status).toBe(200);
    expect(prisma.verificationToken.deleteMany).toHaveBeenLastCalledWith({ where: expect.objectContaining({ identifier: "password-reset:user-1", token: expect.any(String) }) });
    consoleError.mockRestore();
  });
});
