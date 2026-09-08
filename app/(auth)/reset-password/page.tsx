"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthStatusMessage, AuthSubmitButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { WorkspaceField } from "@/components/ui/workspace-field";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    if (!token) return setError("This reset link is invalid or incomplete.");
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
    <AuthShell title={message ? "Password updated" : "Choose a new password"} footer={<p><Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline underline-offset-4">Back to sign in</Link></p>}>
      {message ? <AuthStatusMessage><p>{message}</p></AuthStatusMessage> : (
        <form onSubmit={submit} className="space-y-4">
          <WorkspaceField id="reset-password" label="New password" labelClassName={authLabelClass} hint="Use at least 12 characters."><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authFieldClass} /></WorkspaceField>
          <WorkspaceField id="reset-confirmation" label="Confirm new password" labelClassName={authLabelClass}><Input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={authFieldClass} /></WorkspaceField>
          {error ? <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p> : null}
          <AuthSubmitButton loading={loading} idleLabel="Update password" loadingLabel="Updating…" />
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
