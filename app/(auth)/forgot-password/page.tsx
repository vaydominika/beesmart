"use client";

import { useText } from "@/i18n/use-text";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthStatusMessage, AuthSubmitButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { WorkspaceField } from "@/components/ui/workspace-field";

export default function ForgotPasswordPage() {
  const t = useText();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Password reset could not be requested.");
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Password reset could not be requested.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={message ? t("Check your email") : t("Reset your password")} footer={<p>{t("Remembered it?")} <Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline underline-offset-4">{t("Back to sign in")}</Link></p>}>
      {message ? (
        <AuthStatusMessage>
          <p>{message}</p>
          <p>{t("The reset link expires in one hour.")}</p>
        </AuthStatusMessage>
      ) : (
        <>
          <p className="mb-5 text-sm leading-6 text-[var(--app-text-muted)]">{t("Enter your account email and we will send you a reset link.")}</p>
          <form onSubmit={submit} className="space-y-4">
            <WorkspaceField id="forgot-email" label={t("Email address")} labelClassName={authLabelClass}><Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={authFieldClass} placeholder={t("you@example.com")} /></WorkspaceField>
            {error ? <p role="alert" className="text-sm text-[var(--app-danger)]">{t(error)}</p> : null}
            <AuthSubmitButton loading={loading} idleLabel={t("Send reset link")} loadingLabel={t("Sending…")} />
          </form>
        </>
      )}
    </AuthShell>
  );
}
