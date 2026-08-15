import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";

describe("authentication pages", () => {
  it("renders the login page in sentence case with the shared visual hierarchy", () => {
    const { container } = render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(container.querySelector(".uppercase")).not.toBeInTheDocument();
  });

  it("gives registration the same shell and readable form styling", () => {
    const { container } = render(<RegisterPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(container.querySelector(".uppercase")).not.toBeInTheDocument();
  });
});
