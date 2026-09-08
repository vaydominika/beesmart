"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { AuthDivider, AuthShell, AuthSubmitButton, GoogleAuthButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { CheckEmailView } from "@/components/auth/CheckEmailView";
import { WorkspaceField } from "@/components/ui/workspace-field";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "OAuthAccountNotLinked") {
      toast.error(
        "This email is already registered with a password. Sign in with your password below, or use the same method you used to create your account."
      );
    } else if (error === "CredentialsSignin") {
      toast.error("Invalid email or password.");
    } else if (error) {
      toast.error("Sign-in failed. Please try again.");
    }
    const verification = searchParams.get("verification");
    if (verification === "verified") {
      toast.success("Email verified. You can now sign in.", { id: "email-verification-result" });
    } else if (verification === "invalid") {
      toast.error("This verification link is invalid or has expired.", { id: "email-verification-result" });
    }
  }, [searchParams]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        let pendingVerification = res.code === "email_not_verified";
        if (!pendingVerification) {
          try {
            const statusResponse = await fetch("/api/auth/pending-verification", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
            });
            const status = await statusResponse.json();
            pendingVerification = statusResponse.ok && status.pending === true;
          } catch {
            pendingVerification = false;
          }
        }
        if (pendingVerification) {
          setVerificationEmail(email.trim().toLowerCase());
          return;
        }
        toast.error("Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error ?? "Unable to resend verification email.");
        return;
      }
      toast.success(data.message);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setResending(false);
    }
  };

  if (verificationEmail) {
    return <CheckEmailView email={verificationEmail} />;
  }

  return (
    <AuthShell
      title="Welcome back"
      footer={<p>New to BeeSmart? <Link href="/register" className="font-semibold text-[var(--app-accent-text)] underline decoration-[var(--app-focus-border)] underline-offset-4 hover:no-underline">Create an account</Link></p>}
    >
      <GoogleAuthButton onClick={handleGoogleSignIn} disabled={loading} />
      <AuthDivider />
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <WorkspaceField id="login-email" label="Email address" labelClassName={authLabelClass}><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authFieldClass} placeholder="you@example.com" /></WorkspaceField>
        <div>
          <WorkspaceField id="login-password" label="Password" labelClassName={authLabelClass}><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authFieldClass} placeholder="Enter your password" /></WorkspaceField>
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs font-medium text-[var(--app-accent-text)]">
            <button type="button" onClick={handleResendVerification} disabled={loading || resending} className="hover:underline disabled:opacity-50">{resending ? "Sending…" : "Resend verification email"}</button>
            <Link href="/forgot-password" className="hover:underline">Forgot password?</Link>
          </div>
        </div>
        <AuthSubmitButton loading={loading} idleLabel="Sign in" loadingLabel="Signing in…" />
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="font-[var(--font-geist-sans)] text-sm text-[var(--app-text-muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
