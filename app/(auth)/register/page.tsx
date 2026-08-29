"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { AuthDivider, AuthShell, AuthSubmitButton, GoogleAuthButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { WorkspaceField } from "@/components/ui/workspace-field";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (password.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Registration failed.");
        return;
      }
      const signInRes = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        toast.success("Account created. Please sign in.");
        router.push("/login");
        router.refresh();
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <AuthShell
      title="Create your account"
      footer={<p>Already have an account? <Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline decoration-[var(--app-focus-border)] underline-offset-4 hover:no-underline">Sign in</Link></p>}
    >
      <GoogleAuthButton onClick={handleGoogleSignIn} disabled={loading} />
      <AuthDivider />
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <WorkspaceField id="register-name" label="Name" labelClassName={authLabelClass}><Input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={authFieldClass} placeholder="Your name" /></WorkspaceField>
          <WorkspaceField id="register-email" label="Email address" labelClassName={authLabelClass}><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authFieldClass} placeholder="you@example.com" /></WorkspaceField>
        </div>
        <WorkspaceField id="register-password" label="Password" labelClassName={authLabelClass} hint="Use at least 12 characters."><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authFieldClass} placeholder="At least 12 characters" /></WorkspaceField>
        <WorkspaceField id="register-confirm" label="Confirm password" labelClassName={authLabelClass}><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={authFieldClass} placeholder="Enter the password again" /></WorkspaceField>
        <AuthSubmitButton loading={loading} idleLabel="Create account" loadingLabel="Creating account…" />
      </form>
    </AuthShell>
  );
}
