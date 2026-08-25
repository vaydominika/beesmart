import Link from "next/link";
import { ClipboardList, MessageSquareText } from "lucide-react";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { TicketAttachmentGallery } from "@/components/tickets/TicketAttachmentGallery";
import { WorkspaceEmptyState } from "@/components/ui/workspace-state";
import { getCurrentUserId } from "@/lib/db";
import { getUserTickets, reportTypeLabel } from "@/lib/tickets";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

export default async function TicketsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const tickets = await getUserTickets(userId);
  const activeCount = tickets.filter((ticket) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS").length;

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-[var(--app-canvas)] p-4 font-[var(--font-geist-sans)] md:p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-text)]">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-[var(--font-barlow-condensed)] text-3xl leading-none tracking-[0.02em] text-[var(--app-text)]">My reports</h1>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Track course reports and Early Access feedback.</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs font-semibold text-[var(--app-text-muted)]">
            <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-1.5">{tickets.length} total</span>
            <span className="rounded-full bg-[var(--app-accent-soft)] px-3 py-1.5 text-[var(--app-text)]">{activeCount} active</span>
          </div>
        </header>

        {tickets.length ? (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <article key={ticket.id} id={ticket.id} className="scroll-mt-20 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 target:border-[var(--app-focus-border)] target:ring-2 target:ring-[var(--app-focus-ring)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--app-text-muted)]">{reportTypeLabel(ticket.type)}</p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--app-text)]">
                      {ticket.type === "EARLY_ACCESS_FEEDBACK" ? "Early Access feedback" : ticket.reason}
                    </h2>
                    {ticket.course ? (
                      <Link href={`/courses/${ticket.course.id}`} className="mt-1 inline-flex text-xs font-medium text-[var(--app-info)] hover:underline">
                        {ticket.course.title}
                      </Link>
                    ) : ticket.type === "COURSE_REPORT" ? (
                      <p className="mt-1 text-xs text-[var(--app-text-faint)]">The reported course is no longer available.</p>
                    ) : null}
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </div>

                {ticket.description ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text-muted)]">{ticket.description}</p> : null}

                <TicketAttachmentGallery attachments={ticket.attachments} label="Screenshots" />

                <footer className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--app-border)] pt-3 text-xs text-[var(--app-text-faint)]">
                  <span>Created {formatDate(ticket.createdAt)}</span>
                  <span>Updated {formatDate(ticket.updatedAt)}</span>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <WorkspaceEmptyState dashed className="min-h-72 p-8" icon={<MessageSquareText className="mb-3 h-8 w-8 text-[var(--app-text-faint)]" aria-hidden="true" />} title="No reports yet" description="Course reports and feedback you send will appear here with their latest status." />
        )}
      </div>
    </div>
  );
}
