import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESEND_EMAIL_FROM } from "./env";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "./email";

const resendMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: function Resend(apiKey: string) {
    resendMocks.constructor(apiKey);
    return { emails: { send: resendMocks.send } };
  },
}));

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "re_test_api_key");
    vi.stubEnv("EMAIL_FROM", RESEND_EMAIL_FROM);
    resendMocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends password reset email from the verified domain", async () => {
    await sendPasswordResetEmail({
      to: "ada@example.com",
      resetUrl: "https://beesmart.vay.hu/reset-password?token=secret",
      idempotencyKey: "reset-token-hash",
    });

    expect(resendMocks.constructor).toHaveBeenCalledWith("re_test_api_key");
    expect(resendMocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: RESEND_EMAIL_FROM,
      to: "ada@example.com",
      subject: "Reset your BeeSmart password",
      headers: { "X-Entity-Ref-ID": "reset-token-hash" },
    }), { idempotencyKey: "reset-token-hash" });
  });

  it("rejects an unverified sender before calling Resend", async () => {
    vi.stubEnv("EMAIL_FROM", "BeeSmart <noreply@example.com>");

    await expect(sendPasswordResetEmail({
      to: "ada@example.com",
      resetUrl: "https://beesmart.vay.hu/reset-password?token=secret",
      idempotencyKey: "reset-token-hash",
    })).rejects.toThrow(`EMAIL_FROM must be ${RESEND_EMAIL_FROM}`);
    expect(resendMocks.constructor).not.toHaveBeenCalled();
    expect(resendMocks.send).not.toHaveBeenCalled();
  });

  it("reports Resend delivery errors", async () => {
    resendMocks.send.mockResolvedValue({ data: null, error: { message: "Domain is not verified" } });

    await expect(sendPasswordResetEmail({
      to: "ada@example.com",
      resetUrl: "https://beesmart.vay.hu/reset-password?token=secret",
      idempotencyKey: "reset-token-hash",
    })).rejects.toThrow("Resend rejected password reset email: Domain is not verified");
  });

  it("sends account verification email from the verified domain", async () => {
    await sendEmailVerificationEmail({
      to: "ada@example.com",
      verificationUrl: "https://beesmart.vay.hu/api/auth/verify-email?token=secret",
      idempotencyKey: "verification-token-hash",
    });

    expect(resendMocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: RESEND_EMAIL_FROM,
      to: "ada@example.com",
      subject: "Verify your BeeSmart email",
      text: expect.stringContaining("expires in 24 hours"),
      html: expect.stringContaining("Verify email"),
    }), { idempotencyKey: "verification-token-hash" });
  });
});
