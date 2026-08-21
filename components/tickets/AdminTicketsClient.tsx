"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  ImageIcon,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import type { ReportStatus, ReportType } from "@/lib/generated/prisma";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { toast } from "@/components/ui/sonner";
import { ACTIVE_REPORT_STATUSES, REPORT_STATUS_OPTIONS, reportTypeLabel } from "@/lib/ticket-types";
import { cn } from "@/lib/utils";

export type AdminTicketItem = {
  id: string;
  type: ReportType;
  status: ReportStatus;
  reason: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reporter: { id: string; name: string; email: string };
  reviewer: { id: string; name: string; email: string } | null;
  course: { id: string; title: string } | null;
  attachments: Array<{ id: string; storedFile: { id: string; originalName: string } }>;
};

type View = "active" | "all";
type Queue = "reports" | "feedback";
type AdminTheme = "light" | "dark";

const ADMIN_THEME_STORAGE_KEY = "beesmart-admin-theme";

const adminThemes: Record<AdminTheme, CSSProperties> = {
  light: {
    "--app-canvas": "#f7f7f5",
    "--app-surface": "#ffffff",
    "--app-surface-muted": "#eeeeeb",
    "--app-text": "#171715",
    "--app-text-muted": "#666661",
    "--app-text-faint": "#969690",
    "--app-border": "#ddddd8",
    "--app-border-strong": "#a8a8a1",
    "--app-accent-soft": "#e5e5e0",
    "--app-focus-border": "#171715",
    "--app-focus-ring": "#8a8a84",
    "--app-shadow-soft": "0 12px 32px rgba(17, 17, 15, 0.12)",
  } as CSSProperties,
  dark: {
    "--app-canvas": "#0d0d0c",
    "--app-surface": "#171716",
    "--app-surface-muted": "#222220",
    "--app-text": "#f2f2ed",
    "--app-text-muted": "#adada6",
    "--app-text-faint": "#777771",
    "--app-border": "#30302e",
    "--app-border-strong": "#5f5f59",
    "--app-accent-soft": "#2b2b29",
    "--app-focus-border": "#f2f2ed",
    "--app-focus-ring": "#85857e",
    "--app-shadow-soft": "0 18px 50px rgba(0, 0, 0, 0.48)",
  } as CSSProperties,
};

const selectPortalThemes: Record<AdminTheme, string> = {
  light: "font-[var(--font-geist-sans)] [--app-surface:#ffffff] [--app-surface-muted:#eeeeeb] [--app-accent-soft:#e5e5e0] [--app-text:#171715] [--app-text-muted:#666661] [--app-text-faint:#969690] [--app-border:#ddddd8] [--app-focus-ring:#8a8a84] [--app-shadow-soft:0_12px_32px_rgba(17,17,15,0.12)]",
  dark: "font-[var(--font-geist-sans)] [--app-surface:#171716] [--app-surface-muted:#222220] [--app-accent-soft:#2b2b29] [--app-text:#f2f2ed] [--app-text-muted:#adada6] [--app-text-faint:#777771] [--app-border:#30302e] [--app-focus-ring:#85857e] [--app-shadow-soft:0_18px_50px_rgba(0,0,0,0.48)]",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function caseReference(id: string) {
  return id.slice(-8).toUpperCase();
}

function belongsToQueue(ticket: AdminTicketItem, queue: Queue) {
  return queue === "feedback"
    ? ticket.type === "EARLY_ACCESS_FEEDBACK"
    : ticket.type !== "EARLY_ACCESS_FEEDBACK";
}

export function AdminTicketsClient({
  initialTickets,
  currentAdmin,
}: {
  initialTickets: AdminTicketItem[];
  currentAdmin: { name: string; email: string };
}) {
  const [view, setView] = useState<View>("active");
  const [queue, setQueue] = useState<Queue>("reports");
  const [theme, setTheme] = useState<AdminTheme>("light");
  const [tickets, setTickets] = useState(initialTickets);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  const queueCounts = useMemo(() => ({
    reports: tickets.filter((ticket) => belongsToQueue(ticket, "reports")).length,
    feedback: tickets.filter((ticket) => belongsToQueue(ticket, "feedback")).length,
  }), [tickets]);

  const queueTickets = useMemo(
    () => tickets.filter((ticket) => belongsToQueue(ticket, queue)),
    [queue, tickets],
  );
  const activeCount = queueTickets.filter((ticket) => ACTIVE_REPORT_STATUSES.includes(ticket.status)).length;
  const visibleTickets = useMemo(
    () => view === "all" ? queueTickets : queueTickets.filter((ticket) => ACTIVE_REPORT_STATUSES.includes(ticket.status)),
    [queueTickets, view],
  );

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, nextTheme);
  };

  const updateStatus = async (ticketId: string, status: ReportStatus) => {
    const current = tickets.find((ticket) => ticket.id === ticketId);
    if (!current || current.status === status) return;
    setUpdatingId(ticketId);
    try {
      const response = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Status could not be updated");
      setTickets((items) => items.map((ticket) => ticket.id === ticketId ? {
        ...ticket,
        status: result.status,
        updatedAt: result.updatedAt,
        reviewedAt: result.reviewedAt,
        reviewer: { id: "current", ...currentAdmin },
      } : ticket));
      toast.success("Ticket status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status could not be updated");
    } finally {
      setUpdatingId(null);
    }
  };

  const queueTitle = queue === "reports" ? "Course reports" : "Feedback";

  return (
    <div
      style={{ ...adminThemes[theme], colorScheme: theme, fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
      data-admin-theme={theme}
      className="min-h-[100dvh] bg-[var(--app-canvas)] font-[var(--font-geist-sans)] text-[var(--app-text)] transition-colors duration-200 motion-reduce:transition-none"
    >
      <header className="border-b border-[var(--app-border)] bg-[var(--app-canvas)]">
        <div className="mx-auto flex min-h-16 w-full max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap md:px-6">
          <h1 className="mr-2 text-base font-semibold tracking-[-0.02em]">Admin</h1>

          <WorkspaceTabs
            ariaLabel="Submission queue"
            value={queue}
            onValueChange={setQueue}
            fill
            items={[
              {
                value: "reports",
                label: <span>Course reports <span className="ml-1 font-mono text-[10px] text-[var(--app-text-faint)]">{queueCounts.reports}</span></span>,
                ariaLabel: `Course reports, ${queueCounts.reports} ${queueCounts.reports === 1 ? "submission" : "submissions"}`,
              },
              {
                value: "feedback",
                label: <span>Feedback <span className="ml-1 font-mono text-[10px] text-[var(--app-text-faint)]">{queueCounts.feedback}</span></span>,
                ariaLabel: `Feedback, ${queueCounts.feedback} ${queueCounts.feedback === 1 ? "submission" : "submissions"}`,
              },
            ]}
            className="order-3 w-full bg-[var(--app-surface)] md:order-none md:w-auto"
            tabClassName="md:min-w-32"
          />

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-[background-color,color,transform] duration-200 hover:scale-105 hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] motion-reduce:hover:scale-100"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link href="/dashboard" aria-label="Back to learning app" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-[background-color,color,transform] duration-200 hover:scale-105 hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] motion-reduce:hover:scale-100">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-[background-color,color,transform] duration-200 hover:scale-105 hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] motion-reduce:hover:scale-100" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
        <section aria-labelledby="admin-queue-heading">
          <h2 id="admin-queue-heading" className="sr-only">{queueTitle}</h2>
          <div className="flex justify-end">
            <WorkspaceTabs
              ariaLabel={`${queueTitle} view`}
              value={view}
              onValueChange={setView}
              size="compact"
              items={[
                { value: "active", label: <>Active <span className="ml-1 font-mono text-[10px] opacity-70">{activeCount}</span></> },
                { value: "all", label: <>All <span className="ml-1 font-mono text-[10px] opacity-70">{queueTickets.length}</span></> },
              ]}
            />
          </div>

          {visibleTickets.length ? (
            <div key={`${queue}-${view}`} className="mt-5 space-y-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
              {visibleTickets.map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--app-border-strong)] motion-reduce:hover:translate-y-0 md:p-6">
                  <div>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--app-text-faint)]">{caseReference(ticket.id)}</span>
                          <span className="text-xs text-[var(--app-text-muted)]">{reportTypeLabel(ticket.type)}</span>
                          {ticket.type === "AUTOMATED_COURSE_FLAG" ? <Bot className="h-3.5 w-3.5 text-[var(--app-text-faint)]" aria-label="Automated" /> : null}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold tracking-[-0.015em] text-[var(--app-text)]">{ticket.reason}</h3>
                        {ticket.description ? <p className="mt-1.5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[var(--app-text-muted)]">{ticket.description}</p> : null}
                      </div>
                      <div className="w-full shrink-0 lg:w-40">
                        <WorkspaceSelect
                          value={ticket.status}
                          options={REPORT_STATUS_OPTIONS}
                          onValueChange={(status) => void updateStatus(ticket.id, status)}
                          ariaLabel={`Status for ${ticket.reason}`}
                          disabled={updatingId === ticket.id}
                          className="w-full rounded-xl"
                          contentClassName={cn("rounded-xl", selectPortalThemes[theme])}
                        />
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-x-8 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-[10px] text-[var(--app-text-faint)]">{ticket.type === "AUTOMATED_COURSE_FLAG" ? "User" : "Reporter"}</dt><dd className="mt-0.5 truncate text-[var(--app-text-muted)]">{ticket.reporter.name} · {ticket.reporter.email}</dd></div>
                      <div><dt className="text-[10px] text-[var(--app-text-faint)]">Course</dt><dd className="mt-0.5 truncate text-[var(--app-text-muted)]">{ticket.course ? <Link href={`/courses/${ticket.course.id}`} className="underline decoration-[var(--app-border-strong)] underline-offset-4 hover:decoration-[var(--app-text)]">{ticket.course.title}</Link> : "—"}</dd></div>
                      <div><dt className="text-[10px] text-[var(--app-text-faint)]">Created</dt><dd className="mt-0.5 text-[var(--app-text-muted)]">{formatDate(ticket.createdAt)}</dd></div>
                      <div><dt className="text-[10px] text-[var(--app-text-faint)]">Reviewed</dt><dd className="mt-0.5 text-[var(--app-text-muted)]">{ticket.reviewedAt ? formatDate(ticket.reviewedAt) : "—"}{ticket.reviewer ? <span className="ml-1">· {ticket.reviewer.name}</span> : null}</dd></div>
                    </dl>

                    {ticket.attachments.length ? (
                      <div className="mt-4">
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] text-[var(--app-text-faint)]"><ImageIcon className="h-3.5 w-3.5" /> Attachments</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                          {ticket.attachments.map(({ storedFile }) => (
                            <a key={storedFile.id} href={`/api/files/${storedFile.id}`} target="_blank" rel="noreferrer" className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]">
                              <Image src={`/api/files/${storedFile.id}`} alt={storedFile.originalName} fill unoptimized className="object-cover transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div key={`${queue}-${view}`} className="mt-5 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] text-center animate-in fade-in-0 duration-200 motion-reduce:animate-none">
              <p className="text-sm text-[var(--app-text-faint)]">{view === "active" ? `No active ${queue === "reports" ? "reports" : "feedback"}.` : `No ${queue === "reports" ? "reports" : "feedback"}.`}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
