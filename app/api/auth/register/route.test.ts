import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const tx = {
  user: { create: vi.fn() },
  verificationToken: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({ sendEmailVerificationEmail: vi.fn() }));

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
    vi.mocked(prisma.user.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.verificationToken.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.$transaction).mockImplementation((async (operation: unknown) => {
      if (typeof operation === "function") return operation(tx);
      return Promise.all(operation as Promise<unknown>[]);
    }) as never);
    tx.user.create.mockResolvedValue({ id: "user-1" });
    tx.verificationToken.create.mockResolvedValue({});
    vi.mocked(sendEmailVerificationEmail).mockResolvedValue(undefined);
    vi.stubEnv("AUTH_URL", "https://beesmart.vay.hu");
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

  it("creates an unverified account and sends a verification email", async () => {
    const response = await POST(registration({ name: "  Ada  ", email: "ADA@EXAMPLE.COM", password: "correct-horse-battery" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, verificationRequired: true });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { name: "Ada", email: "ada@example.com", password: "hashed-password" },
      select: { id: true },
    });
    expect(tx.verificationToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      identifier: "email-verification:user-1",
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
      expires: expect.any(Date),
    }) });
    expect(sendEmailVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "ada@example.com",
      verificationUrl: expect.stringMatching(/^https:\/\/beesmart\.vay\.hu\/api\/auth\/verify-email\?token=/),
    }));
  });

  it("removes the account when the verification email cannot be sent", async () => {
    vi.mocked(sendEmailVerificationEmail).mockRejectedValue(new Error("delivery failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(registration({ name: "Ada", email: "ada@example.com", password: "correct-horse-battery" }));

    expect(response.status).toBe(503);
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "email-verification:user-1" },
    });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: "user-1", emailVerified: null } });
    consoleError.mockRestore();
  });
});
