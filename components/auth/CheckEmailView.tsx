import Link from "next/link";
import { AuthShell, AuthStatusMessage } from "@/components/auth/AuthShell";

export function CheckEmailView({ email }: { email: string }) {
  return (
    <AuthShell
      title="Check your email"
      footer={<p>Already verified? <Link href="/login" className="font-semibold text-[var(--app-accent-text)] underline decoration-[var(--app-focus-border)] underline-offset-4 hover:no-underline">Sign in</Link></p>}
    >
      <AuthStatusMessage>
        <p>We sent a verification link to <strong className="text-[var(--app-text)]">{email}</strong>.</p>
        <p>Open the link within 24 hours to activate your account.</p>
      </AuthStatusMessage>
    </AuthShell>
  );
}
