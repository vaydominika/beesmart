import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { hashEmailVerificationToken } from "@/lib/email-verification";
import { GET } from "./route";

const tx = {
  verificationToken: { deleteMany: vi.fn() },
  user: { updateMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    verificationToken: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const rawToken = "a-valid-email-verification-token-12345";
const request = (token = rawToken) => new Request(`https://beesmart.vay.hu/api/auth/verify-email?token=${token}`);

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((async (
      callback: (client: typeof tx) => Promise<unknown>,
    ) => callback(tx)) as never);
    tx.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it("redirects invalid or expired tokens to login", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://beesmart.vay.hu/login?verification=invalid");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("consumes the token, verifies the user, and redirects to login", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue({
      identifier: "email-verification:user-1",
      token: hashEmailVerificationToken(rawToken),
      expires: new Date(Date.now() + 60_000),
    });

    const response = await GET(request());

    expect(response.headers.get("location")).toBe("https://beesmart.vay.hu/login?verification=verified");
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
    expect(tx.verificationToken.deleteMany).toHaveBeenCalledTimes(2);
  });

  it("rejects a verification link that was consumed concurrently", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue({
      identifier: "email-verification:user-1",
      token: hashEmailVerificationToken(rawToken),
      expires: new Date(Date.now() + 60_000),
    });
    tx.verificationToken.deleteMany.mockResolvedValueOnce({ count: 0 });

    const response = await GET(request());

    expect(response.headers.get("location")).toBe("https://beesmart.vay.hu/login?verification=invalid");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});
