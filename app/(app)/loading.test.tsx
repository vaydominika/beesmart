import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AppLoading from "./loading";

describe("AppLoading", () => {
  it("announces an in-shell page transition", () => {
    const { container } = render(<AppLoading />);

    expect(screen.getByRole("status", { name: "Loading page" })).toHaveClass(
      "animate-spin",
      "motion-reduce:animate-none",
    );
    expect(container.firstElementChild).toHaveClass("sticky", "top-0");
  });
});
