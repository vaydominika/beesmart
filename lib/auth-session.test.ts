import { describe, expect, it, vi } from "vitest";
import { validSessionUserId, validateSessionToken } from "./auth-session";

describe("authentication session validation", () => {
  it("keeps a token only while its user still exists", async () => {
    const userExists = vi.fn().mockResolvedValue(true);
    const token = await validateSessionToken({ id: "user-1", sub: "user-1" }, null, userExists);

    expect(userExists).toHaveBeenCalledWith("user-1");
    expect(validSessionUserId(token)).toBe("user-1");
    expect(token.sessionInvalid).toBe(false);
  });

  it("invalidates a stale token whose account no longer exists", async () => {
    const token = await validateSessionToken(
      { id: "missing-user", sub: "missing-user", name: "Guest" },
      null,
      vi.fn().mockResolvedValue(false),
    );

    expect(token.id).toBeUndefined();
    expect(token.sub).toBeUndefined();
    expect(token.sessionInvalid).toBe(true);
    expect(validSessionUserId(token)).toBeNull();
  });

  it("rejects tokens without a usable user id", async () => {
    const userExists = vi.fn();
    const token = await validateSessionToken({}, null, userExists);

    expect(userExists).not.toHaveBeenCalled();
    expect(validSessionUserId(token)).toBeNull();
  });
});
