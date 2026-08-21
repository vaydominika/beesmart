import Link from "next/link";
import { BeeSmartLogo } from "@/components/ui/BeeSmartLogo";
import { WorkspaceButton } from "@/components/ui/workspace-button";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-[var(--app-canvas)] p-4 font-[var(--font-geist-sans)]">
      <section className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-10 shadow-[var(--app-shadow-soft)] sm:px-10 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-14 font-[var(--font-koulen)] text-[13rem] leading-none text-[var(--app-accent-soft)] sm:text-[18rem]">404</div>
        <div className="relative z-10 max-w-md">
          <BeeSmartLogo className="mb-5 w-36" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-text-faint)]">Page not found</p>
          <h1 className="mt-2 font-[var(--font-koulen)] text-5xl leading-[0.92] tracking-[0.02em] text-[var(--app-text)] sm:text-6xl">This page left the hive.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--app-text-muted)]">The address may have changed, or the page is no longer available.</p>
          <WorkspaceButton asChild variant="primary" className="mt-7">
            <Link href="/dashboard">Back to dashboard</Link>
          </WorkspaceButton>
        </div>
      </section>
    </main>
  );
}
