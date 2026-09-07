import { describe, expect, it, vi } from "vitest";
import { createPasswordResetToken, hashPasswordResetToken, passwordResetIdentifier, passwordResetUrl } from "./password-reset";

describe("password reset helpers", () => {
  it("creates opaque tokens and hashes them deterministically", () => {
    const token = createPasswordResetToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashPasswordResetToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPasswordResetToken(token)).toBe(hashPasswordResetToken(token));
  });

  it("builds reset identifiers and links from the configured public URL", () => {
    vi.stubEnv("AUTH_URL", "https://beesmart.example/base");
    expect(passwordResetIdentifier("user-1")).toBe("password-reset:user-1");
    expect(passwordResetUrl("secret token")).toBe("https://beesmart.example/reset-password?token=secret+token");
  });
});
