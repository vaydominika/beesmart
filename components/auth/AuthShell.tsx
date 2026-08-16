"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { WorkspaceButton } from "@/components/ui/workspace-button";

interface AuthShellProps {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

export const authFieldClass = "h-11 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3.5 font-[var(--font-geist-sans)] text-sm font-normal text-[var(--app-text)] shadow-none outline-none placeholder:font-normal placeholder:text-[var(--app-text-faint)] hover:border-[var(--app-border-strong)] focus-visible:border-[var(--app-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]";
export const authLabelClass = "mb-1.5 block font-[var(--font-geist-sans)] text-sm font-semibold text-[var(--app-text)]";

export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <main className="relative z-10 mx-auto grid w-full max-w-[980px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-subtle)] lg:min-h-[640px] lg:grid-cols-[0.72fr_1.28fr]">
      <aside className="hidden border-r border-[var(--app-accent-hover)] bg-[var(--app-accent-soft)] p-10 lg:flex lg:flex-col">
        <Link href="/" className="w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-border)]">
          <Image src="/svg/BeeSmartLogo.svg" alt="BeeSmart" width={220} height={88} className="h-[72px] w-auto" priority />
        </Link>

        <div className="mt-auto max-w-[250px] pb-1">
          <div aria-hidden="true" className="mb-5 h-px w-10 bg-[var(--app-focus-border)]" />
          <p className="text-lg font-medium leading-7 text-[var(--app-text)]">
            Courses, classrooms, and your schedule in one place.
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-10 sm:py-9 lg:px-14">
        <Link href="/" className="mb-7 w-fit rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-border)] lg:hidden">
          <Image src="/svg/BeeSmartLogo.svg" alt="BeeSmart" width={190} height={76} className="h-16 w-auto" priority />
        </Link>

        <div className="w-full max-w-[430px] self-center">
          <header>
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.04em] text-[var(--app-text)] sm:text-[38px]">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
          </header>

          <div className="mt-7">{children}</div>
          <div className="mt-6 border-t border-[var(--app-border)] pt-5 text-center text-sm text-[var(--app-text-muted)]">{footer}</div>
        </div>
      </section>
    </main>
  );
}

export function GoogleAuthButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <WorkspaceButton type="button" variant="secondary" onClick={onClick} disabled={disabled} className="h-11 w-full">
      <Image src="/svg/google-icon-logo-svgrepo-com.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
      Continue with Google
    </WorkspaceButton>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <Separator className="flex-1 bg-[var(--app-border)]" />
      <span className="text-xs font-medium text-[var(--app-text-faint)]">or continue with email</span>
      <Separator className="flex-1 bg-[var(--app-border)]" />
    </div>
  );
}

export function AuthSubmitButton({ loading, idleLabel, loadingLabel }: { loading: boolean; idleLabel: string; loadingLabel: string }) {
  return (
    <WorkspaceButton type="submit" variant="primary" disabled={loading} className="mt-1 h-11 w-full rounded-xl border-[var(--app-focus-border)] bg-[var(--app-accent)] text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-accent-hover)]">
      {loading ? loadingLabel : idleLabel}
      {!loading && <ArrowRight className="h-4 w-4" />}
    </WorkspaceButton>
  );
}
