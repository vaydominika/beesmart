import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { hashPasswordResetToken } from "@/lib/password-reset";
import { POST } from "./route";

const tx = {
  verificationToken: { deleteMany: vi.fn() },
  user: { update: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  prisma: {
    verificationToken: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  requestClientAddress: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-password") } }));

const rawToken = "a-valid-password-reset-token-12345";
const request = (body: unknown) => new Request("http://localhost/api/auth/reset-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, limit: 10, remaining: 9, retryAfterSeconds: 0 });
    vi.mocked(prisma.$transaction).mockImplementation((async (
      callback: (client: typeof tx) => Promise<unknown>,
    ) => callback(tx)) as never);
    tx.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue({});
  });

  it("rejects an unknown or expired token", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue(null);
    const response = await POST(request({ token: rawToken, password: "a-new-secure-password" }));
    expect(response.status).toBe(400);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("consumes the token and updates the password", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue({
      identifier: "password-reset:user-1",
      token: hashPasswordResetToken(rawToken),
      expires: new Date(Date.now() + 60_000),
    });
    const response = await POST(request({ token: rawToken, password: "a-new-secure-password" }));
    expect(response.status).toBe(200);
    expect(bcrypt.hash).toHaveBeenCalledWith("a-new-secure-password", 12);
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { password: "hashed-password" } });
    expect(tx.verificationToken.deleteMany).toHaveBeenCalledTimes(2);
  });
});
