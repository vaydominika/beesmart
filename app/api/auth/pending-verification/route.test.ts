import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { passwordCredentialsStatus } from "@/lib/password-credentials";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/password-credentials", () => ({ passwordCredentialsStatus: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  requestClientAddress: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
}));

const request = (body: unknown) => new Request("https://beesmart.vay.hu/api/auth/pending-verification", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/auth/pending-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, limit: 10, remaining: 9, retryAfterSeconds: 0 });
  });

  it("reports pending only after validating an unverified account password", async () => {
    const user = { password: "hashed-password", emailVerified: null };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(passwordCredentialsStatus).mockResolvedValue("unverified");

    const response = await POST(request({ email: " ADA@EXAMPLE.COM ", password: "correct-password" }));

    expect(await response.json()).toEqual({ pending: true });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      select: { password: true, emailVerified: true },
    });
    expect(passwordCredentialsStatus).toHaveBeenCalledWith(user, "correct-password");
  });

  it.each(["invalid", "valid"] as const)("does not expose accounts with %s credentials", async (status) => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(passwordCredentialsStatus).mockResolvedValue(status);
    const response = await POST(request({ email: "ada@example.com", password: "wrong-password" }));
    expect(await response.json()).toEqual({ pending: false });
  });
});
