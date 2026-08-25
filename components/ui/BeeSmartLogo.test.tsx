import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeeSmartLogo } from "./BeeSmartLogo";

describe("BeeSmartLogo", () => {
  it("maps the replacement artwork to theme-aware color tokens", () => {
    render(<BeeSmartLogo />);

    const logo = screen.getByRole("img", { name: "BeeSmart Logo" });
    expect(logo).toHaveAttribute("viewBox", "0 0 167.4 85");
    expect(logo.querySelector('[data-logo-tone="main"]')).toHaveAttribute("fill", "var(--app-logo-mark-outline)");
    expect(logo.querySelector('[data-logo-tone="wing"]')).toHaveAttribute("fill", "var(--app-logo-wing)");
    expect(logo.querySelector('[data-logo-tone="accent"]')).toHaveAttribute("fill", "var(--app-focus-border)");
    expect(logo.querySelectorAll("path")).toHaveLength(18);
  });
});
