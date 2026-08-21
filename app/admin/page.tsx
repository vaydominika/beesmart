import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminTicketsClient, type AdminTicketItem } from "@/components/tickets/AdminTicketsClient";
import { isAdminEmail } from "@/lib/admin";
import { getAdminTickets } from "@/lib/tickets";

export default async function AdminPage() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) notFound();

  const tickets = await getAdminTickets();
  const serialized: AdminTicketItem[] = tickets.map((ticket) => ({
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    reviewedAt: ticket.reviewedAt?.toISOString() ?? null,
  }));

  return (
    <AdminTicketsClient
      initialTickets={serialized}
      currentAdmin={{ name: session?.user?.name ?? "Admin", email: session?.user?.email ?? "" }}
    />
  );
}
