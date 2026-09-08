import { describe, expect, it, vi } from "vitest";
import {
  createEmailVerificationToken,
  emailVerificationIdentifier,
  emailVerificationUrl,
  hashEmailVerificationToken,
} from "./email-verification";

describe("email verification helpers", () => {
  it("creates opaque tokens and hashes them deterministically", () => {
    const token = createEmailVerificationToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashEmailVerificationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashEmailVerificationToken(token)).toBe(hashEmailVerificationToken(token));
  });

  it("builds verification identifiers and links from the public URL", () => {
    vi.stubEnv("AUTH_URL", "https://beesmart.vay.hu/base");
    expect(emailVerificationIdentifier("user-1")).toBe("email-verification:user-1");
    expect(emailVerificationUrl("secret token"))
      .toBe("https://beesmart.vay.hu/api/auth/verify-email?token=secret+token");
  });
});
