"use client";

import { useText } from "@/i18n/use-text";
import Link from "next/link";
import { AuthShell, AuthStatusMessage } from "@/components/auth/AuthShell";

export function CheckEmailView({ email }: { email: string }) {
  const t = useText();
  return (
    <AuthShell
      title={t("Check your email")}
      footer={<p>{t("Already verified?")} <Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline decoration-[var(--app-focus-border)] underline-offset-4 hover:no-underline">{t("Sign in")}</Link></p>}
    >
      <AuthStatusMessage>
        <p>{t("We sent a verification link to")} <strong className="text-[var(--app-text)]">{email}</strong>.</p>
        <p>{t("Open the link within 24 hours to activate your account.")}</p>
      </AuthStatusMessage>
    </AuthShell>
  );
}
