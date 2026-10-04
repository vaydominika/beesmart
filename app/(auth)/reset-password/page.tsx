"use client";

import { useText } from "@/i18n/use-text";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthStatusMessage, AuthSubmitButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { WorkspaceField } from "@/components/ui/workspace-field";

function ResetPasswordForm() {
  const t = useText();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 12) return setError(t("Password must be at least 12 characters."));
    if (password !== confirmation) return setError(t("Passwords do not match."));
    if (!token) return setError(t("This reset link is invalid or incomplete."));
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Password could not be updated.");
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Password could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={message ? t("Password updated") : t("Choose a new password")} footer={<p><Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline underline-offset-4">{t("Back to sign in")}</Link></p>}>
      {message ? <AuthStatusMessage><p>{t(message)}</p></AuthStatusMessage> : (
        <form onSubmit={submit} className="space-y-4">
          <WorkspaceField id="reset-password" label={t("New password")} labelClassName={authLabelClass} hint={t("Use at least 12 characters.")}><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authFieldClass} /></WorkspaceField>
          <WorkspaceField id="reset-confirmation" label={t("Confirm new password")} labelClassName={authLabelClass}><Input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={authFieldClass} /></WorkspaceField>
          {error ? <p role="alert" className="text-sm text-[var(--app-danger)]">{t(error)}</p> : null}
          <AuthSubmitButton loading={loading} idleLabel={t("Update password")} loadingLabel={t("Updating…")} />
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
