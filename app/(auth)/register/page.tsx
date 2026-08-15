"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { AuthDivider, AuthShell, AuthSubmitButton, GoogleAuthButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";

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
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
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
      description="Set up your BeeSmart space and start organizing how you learn."
      footer={<p>Already have an account? <Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline decoration-[var(--app-focus-border)] underline-offset-4 hover:no-underline">Sign in</Link></p>}
    >
      <GoogleAuthButton onClick={handleGoogleSignIn} disabled={loading} />
      <AuthDivider />
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="register-name" className={authLabelClass}>Name</label>
            <Input id="register-name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={authFieldClass} placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="register-email" className={authLabelClass}>Email address</label>
            <Input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authFieldClass} placeholder="you@example.com" />
          </div>
        </div>
        <div>
          <label htmlFor="register-password" className={authLabelClass}>Password</label>
          <Input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authFieldClass} placeholder="At least 6 characters" />
          <p className="mt-1.5 text-xs text-[var(--app-text-faint)]">Use at least 6 characters.</p>
        </div>
        <div>
          <label htmlFor="register-confirm" className={authLabelClass}>Confirm password</label>
          <Input id="register-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={authFieldClass} placeholder="Enter the password again" />
        </div>
        <AuthSubmitButton loading={loading} idleLabel="Create account" loadingLabel="Creating account…" />
      </form>
    </AuthShell>
  );
}
