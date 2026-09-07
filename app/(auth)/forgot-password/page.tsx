"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthSubmitButton, authFieldClass, authLabelClass } from "@/components/auth/AuthShell";
import { WorkspaceField } from "@/components/ui/workspace-field";

export default function ForgotPasswordPage() {
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
    <AuthShell title="Reset your password" footer={<p>Remembered it? <Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline underline-offset-4">Back to sign in</Link></p>}>
      <p className="mb-5 text-sm leading-6 text-[var(--app-text-muted)]">Enter your account email and we will send you a reset link.</p>
      {message ? <p role="status" className="rounded-xl bg-[var(--app-accent-soft)] p-4 text-sm text-[var(--app-text)]">{message}</p> : (
        <form onSubmit={submit} className="space-y-4">
          <WorkspaceField id="forgot-email" label="Email address" labelClassName={authLabelClass}><Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={authFieldClass} placeholder="you@example.com" /></WorkspaceField>
          {error ? <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p> : null}
          <AuthSubmitButton loading={loading} idleLabel="Send reset link" loadingLabel="Sending…" />
        </form>
      )}
    </AuthShell>
  );
}
