import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeeSmartLogo } from "./BeeSmartLogo";

describe("BeeSmartLogo", () => {
  it("maps the replacement artwork to theme-aware color tokens", () => {
    render(<BeeSmartLogo />);

    const logo = screen.getByRole("img", { name: "BeeSmart Logo" });
    expect(logo).toHaveAttribute("viewBox", "1 89.5 140 60");
    const outline = logo.querySelector('[data-logo-tone="outline"]');
    expect(outline).toHaveAttribute("fill", "var(--app-logo-mark-outline)");
    expect(outline).not.toHaveAttribute("stroke");
    const stroke = logo.querySelector('[data-logo-tone="stroke"]');
    expect(stroke).toHaveAttribute("fill", "none");
    expect(stroke).toHaveAttribute("stroke", "var(--app-logo-mark-stroke)");
    expect(stroke).toHaveAttribute("stroke-width", "2.5");
    expect(stroke).toHaveAttribute("vector-effect", "non-scaling-stroke");
    expect(logo.querySelector('[data-logo-tone="main"]')).toHaveAttribute("fill", "var(--app-text)");
    expect(logo.querySelector('[data-logo-tone="wing"]')).toHaveAttribute("fill", "var(--app-logo-wing)");
    expect(logo.querySelector('[data-logo-tone="accent"]')).toHaveAttribute("fill", "var(--app-logo-accent)");
    expect(logo.querySelectorAll("path")).toHaveLength(21);
  });
});
