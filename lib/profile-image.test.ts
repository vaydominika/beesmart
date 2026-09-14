import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_IMAGE_URL, profileImageUrl } from "./profile-image";

describe("profileImageUrl", () => {
  it("uses the lily when an avatar is missing", () => {
    expect(profileImageUrl(null)).toBe(DEFAULT_PROFILE_IMAGE_URL);
    expect(profileImageUrl("   ")).toBe(DEFAULT_PROFILE_IMAGE_URL);
  });

  it("uses the lily instead of Google's generated account avatar", () => {
    expect(profileImageUrl("https://lh3.googleusercontent.com/a/default-user=s96-c")).toBe(DEFAULT_PROFILE_IMAGE_URL);
  });

  it("keeps an avatar explicitly uploaded to BeeSmart", () => {
    expect(profileImageUrl(" /api/files/avatar-1 ")).toBe("/api/files/avatar-1");
  });
});
