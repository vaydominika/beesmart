import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";
import ForgotPasswordPage from "./forgot-password/page";
import ResetPasswordPage from "./reset-password/page";

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
    vi.clearAllMocks();
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
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByText("Courses, classrooms, and your schedule in one place.")).not.toBeInTheDocument();
    expect(container.querySelector(".uppercase")).not.toBeInTheDocument();
  });

  it("requests a password reset without exposing account existence", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: "If an account exists for that email, a reset link has been sent." })));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: " ADA@EXAMPLE.COM " } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
    expect(screen.getByRole("status")).toHaveClass("text-left");
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/auth/forgot-password", expect.objectContaining({ body: JSON.stringify({ email: "ADA@EXAMPLE.COM" }) }));
  });

  it("requests a new verification link from the login page", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: "If this account needs verification, a new link has been sent." })));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: " ADA@EXAMPLE.COM " } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("If this account needs verification, a new link has been sent."));
    expect(fetch).toHaveBeenCalledWith("/api/auth/resend-verification", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "ada@example.com" }),
    }));
  });

  it("validates matching passwords on the reset page", () => {
    mocks.searchParams = new URLSearchParams({ token: "valid-token-value-that-is-long-enough" });
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-new-secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the shared success layout after updating a password", async () => {
    mocks.searchParams = new URLSearchParams({ token: "valid-token-value-that-is-long-enough" });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: "Password updated. You can now sign in." })));
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-new-secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "a-new-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("text-left");
    expect(screen.getAllByRole("link", { name: "Back to sign in" })).toHaveLength(1);
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

  it("shows the check-email page instead of an error for an unverified account", async () => {
    mocks.signIn.mockResolvedValue({ error: "CredentialsSignin", code: "email_not_verified" });
    render(<LoginPage />);
    fillLogin("  TEACHER@EXAMPLE.COM  ");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("teacher@example.com");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("recovers the pending state when Auth.js returns a generic credentials error", async () => {
    mocks.signIn.mockResolvedValue({ error: "CredentialsSignin", code: "credentials" });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ pending: true })));
    render(<LoginPage />);
    fillLogin("  TEACHER@EXAMPLE.COM  ");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/auth/pending-verification", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "teacher@example.com", password: "long-enough-password" }),
    }));
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("surfaces OAuth errors and starts Google sign-in", () => {
    mocks.searchParams = new URLSearchParams({ error: "OAuthAccountNotLinked", callbackUrl: "/schedule" });
    render(<LoginPage />);

    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining("already registered"));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(mocks.signIn).toHaveBeenCalledWith("google", { callbackUrl: "/schedule" });
  });

  it("reports email verification results", () => {
    mocks.searchParams = new URLSearchParams({ verification: "verified" });
    const first = render(<LoginPage />);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Email verified. You can now sign in.",
      { id: "email-verification-result" },
    );
    first.unmount();

    mocks.searchParams = new URLSearchParams({ verification: "invalid" });
    render(<LoginPage />);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "This verification link is invalid or has expired.",
      { id: "email-verification-result" },
    );
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

  it("registers normalized credentials and asks the user to verify their email", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, verificationRequired: true }), { status: 201 }));
    render(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).not.toHaveClass("text-center");
    expect(screen.getByRole("status")).toHaveClass("text-left");
    expect(screen.getByRole("status")).toHaveTextContent("teacher@example.com");
    expect(fetch).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Test Teacher", email: "teacher@example.com", password: "long-enough-password" }),
    }));
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows API errors and handles invalid JSON responses", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 409 }));
    render(<RegisterPage />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Registration failed."));
    expect(mocks.signIn).not.toHaveBeenCalled();
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
