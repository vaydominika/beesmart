import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { passwordCredentialsStatus } from "./password-credentials";

vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }));

describe("password credential validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  it("accepts a verified user with the correct password", async () => {
    await expect(passwordCredentialsStatus({
      password: "hashed-password",
      emailVerified: new Date(),
    }, "password")).resolves.toBe("valid");
  });

  it("rejects an unverified user even when the password is correct", async () => {
    await expect(passwordCredentialsStatus({
      password: "hashed-password",
      emailVerified: null,
    }, "password")).resolves.toBe("unverified");
  });

  it("rejects a wrong password", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    await expect(passwordCredentialsStatus({
      password: "hashed-password",
      emailVerified: new Date(),
    }, "password")).resolves.toBe("invalid");
  });
});
