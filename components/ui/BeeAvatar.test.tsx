import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeeAvatar } from "./BeeAvatar";

describe("BeeAvatar", () => {
  it("uses the default profile picture when no avatar is available", () => {
    render(<BeeAvatar avatarUrl={null} />);

    expect(screen.getByRole("img", { name: "Profile" }).getAttribute("src")).toContain(encodeURIComponent("/images/default_pfp.jpg"));
  });

  it("keeps a supplied profile picture", () => {
    render(<BeeAvatar avatarUrl="https://example.com/google-avatar.jpg" />);

    expect(screen.getByRole("img", { name: "Profile" }).getAttribute("src")).toContain(encodeURIComponent("https://example.com/google-avatar.jpg"));
  });
});
