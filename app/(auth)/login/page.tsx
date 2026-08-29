"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { AuthDivider, AuthShell, AuthSubmitButton, GoogleAuthButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { WorkspaceField } from "@/components/ui/workspace-field";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <AuthShell
      title="Welcome back"
      footer={<p>New to BeeSmart? <Link href="/register" className="font-semibold text-[var(--app-accent-text)] underline decoration-[var(--app-focus-border)] underline-offset-4 hover:no-underline">Create an account</Link></p>}
    >
      <GoogleAuthButton onClick={handleGoogleSignIn} disabled={loading} />
      <AuthDivider />
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <WorkspaceField id="login-email" label="Email address" labelClassName={authLabelClass}><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authFieldClass} placeholder="you@example.com" /></WorkspaceField>
        <WorkspaceField id="login-password" label="Password" labelClassName={authLabelClass}><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authFieldClass} placeholder="Enter your password" /></WorkspaceField>
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
