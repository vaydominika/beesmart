import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  searchParams: new URLSearchParams(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

function fillLogin(email = "teacher@example.com", password = "long-enough-password") {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

function fillRegistration(password = "long-enough-password", confirmation = password) {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Test Teacher  " } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "  TEACHER@EXAMPLE.COM  " } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirmation } });
}

describe("authentication pages", () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the login page in sentence case with the shared visual hierarchy", () => {
    const { container } = render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveAttribute("data-slot", "workspace-button");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveClass("h-11", "rounded-xl");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Courses, classrooms, and your schedule in one place.")).not.toBeInTheDocument();
    expect(container.querySelector(".uppercase")).not.toBeInTheDocument();
  });

  it("validates missing login credentials", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.toastError).toHaveBeenCalledWith("Please enter email and password.");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("signs in with trimmed credentials and honors a callback", async () => {
    mocks.searchParams = new URLSearchParams({ callbackUrl: "/classrooms" });
    mocks.signIn.mockResolvedValue({ ok: true });
    render(<LoginPage />);
    fillLogin("  teacher@example.com  ");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/classrooms"));
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "teacher@example.com",
      password: "long-enough-password",
      redirect: false,
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("reports rejected and failed credential sign-ins", async () => {
    mocks.signIn.mockResolvedValueOnce({ error: "CredentialsSignin" }).mockRejectedValueOnce(new Error("offline"));
    const first = render(<LoginPage />);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Invalid email or password."));
    first.unmount();

    render(<LoginPage />);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Something went wrong."));
  });

  it("surfaces OAuth errors and starts Google sign-in", () => {
    mocks.searchParams = new URLSearchParams({ error: "OAuthAccountNotLinked", callbackUrl: "/schedule" });
    render(<LoginPage />);

    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining("already registered"));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/schedule" });
  });

  it("gives registration the same shell and readable form styling", () => {
    const { container } = render(<RegisterPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(container.querySelector(".uppercase")).not.toBeInTheDocument();
  });

  it.each([
    ["missing fields", "", "", "Please fill in all fields."],
    ["short passwords", "short", "short", "Password must be at least 12 characters."],
    ["mismatched passwords", "long-enough-password", "different-password", "Passwords do not match."],
  ])("validates %s", (_case, password, confirmation, message) => {
    render(<RegisterPage />);
    if (password) fillRegistration(password, confirmation);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(mocks.toastError).toHaveBeenCalledWith(message);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("registers normalized credentials and opens the dashboard", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: "user-1" }), { status: 201 }));
    mocks.signIn.mockResolvedValue({ ok: true });
    render(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard?welcome=new"));
    expect(fetch).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Test Teacher", email: "teacher@example.com", password: "long-enough-password" }),
    }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows API errors and handles invalid JSON responses", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 409 }));
    render(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Registration failed."));
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("redirects to login when automatic sign-in fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 201 }));
    mocks.signIn.mockResolvedValue({ error: "CredentialsSignin" });
    render(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login"));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Account created. Please sign in.");
  });

  it("handles registration network failure and Google registration", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const first = render(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Something went wrong."));
    first.unmount();

    render(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/dashboard?welcome=new" });
  });
});
