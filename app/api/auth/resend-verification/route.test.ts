import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/email", () => ({ sendEmailVerificationEmail: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  requestClientAddress: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
}));

const request = (email: string) => new Request("https://beesmart.vay.hu/api/auth/resend-verification", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_URL", "https://beesmart.vay.hu");
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, limit: 3, remaining: 2, retryAfterSeconds: 0 });
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
    vi.mocked(prisma.verificationToken.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.verificationToken.create).mockResolvedValue({} as never);
    vi.mocked(sendEmailVerificationEmail).mockResolvedValue(undefined);
  });

  it("does not reveal whether an account needs verification", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const response = await POST(request("missing@example.com"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "If this account needs verification, a new link has been sent." });
    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("replaces the token and sends a new link for an unverified password account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      password: "hashed-password",
      emailVerified: null,
    } as never);

    const response = await POST(request(" ADA@EXAMPLE.COM "));

    expect(response.status).toBe(200);
    expect(prisma.verificationToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      identifier: "email-verification:user-1",
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
    }) });
    expect(sendEmailVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "ada@example.com",
      verificationUrl: expect.stringMatching(/^https:\/\/beesmart\.vay\.hu\/api\/auth\/verify-email\?token=/),
    }));
  });

  it("removes an unusable token when delivery fails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      password: "hashed-password",
      emailVerified: null,
    } as never);
    vi.mocked(sendEmailVerificationEmail).mockRejectedValue(new Error("delivery failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await POST(request("ada@example.com"));

    expect(prisma.verificationToken.deleteMany).toHaveBeenLastCalledWith({
      where: { identifier: "email-verification:user-1", token: expect.any(String) },
    });
    consoleError.mockRestore();
  });
});
