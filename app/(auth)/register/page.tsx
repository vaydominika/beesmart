"use client";

import { useText } from "@/i18n/use-text";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { AuthDivider, AuthShell, AuthSubmitButton, GoogleAuthButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { CheckEmailView } from "@/components/auth/CheckEmailView";
import { WorkspaceField } from "@/components/ui/workspace-field";

export default function RegisterPage() {
  const t = useText();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error(t("Please fill in all fields."));
      return;
    }
    if (password.length < 12) {
      toast.error(t("Password must be at least 12 characters."));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("Passwords do not match."));
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
        toast.error(t(data.error ?? "Registration failed."));
        return;
      }
      setVerificationEmail(email.trim().toLowerCase());
    } catch {
      toast.error(t("Something went wrong."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard?welcome=new" });
  };

  if (verificationEmail) {
    return <CheckEmailView email={verificationEmail} />;
  }

  return (
    <AuthShell
      title={t("Create your account")}
      footer={<p>{t("Already have an account?")} <Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline decoration-[var(--app-focus-border)] underline-offset-4 hover:no-underline">{t("Sign in")}</Link></p>}
    >
      <GoogleAuthButton onClick={handleGoogleSignIn} disabled={loading} />
      <AuthDivider />
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <WorkspaceField id="register-name" label={t("Name")} labelClassName={authLabelClass}><Input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={authFieldClass} placeholder={t("Your name")} /></WorkspaceField>
          <WorkspaceField id="register-email" label={t("Email address")} labelClassName={authLabelClass}><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authFieldClass} placeholder={t("you@example.com")} /></WorkspaceField>
        </div>
        <WorkspaceField id="register-password" label={t("Password")} labelClassName={authLabelClass} hint={t("Use at least 12 characters.")}><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authFieldClass} placeholder={t("At least 12 characters")} /></WorkspaceField>
        <WorkspaceField id="register-confirm" label={t("Confirm password")} labelClassName={authLabelClass}><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={authFieldClass} placeholder={t("Enter the password again")} /></WorkspaceField>
        <AuthSubmitButton loading={loading} idleLabel={t("Create account")} loadingLabel={t("Creating account…")} />
      </form>
    </AuthShell>
  );
}
