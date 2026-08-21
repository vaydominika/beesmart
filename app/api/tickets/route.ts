import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma";
import { getCurrentUserId, prisma } from "@/lib/db";
import { claimUploads, UploadClaimError } from "@/lib/files/lifecycle";
import { earlyAccessFeedbackEnabled, ticketReceivedNotification } from "@/lib/tickets";

const MAX_TICKET_IMAGES = 5;
const MAX_DESCRIPTION_LENGTH = 10_000;

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!earlyAccessFeedbackEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const uploadIds = Array.isArray(body.uploadIds) && body.uploadIds.every((id: unknown) => typeof id === "string")
      ? body.uploadIds as string[]
      : [];

    if (!description) return NextResponse.json({ error: "Describe your feedback before sending it" }, { status: 400 });
    if (description.length > MAX_DESCRIPTION_LENGTH) return NextResponse.json({ error: "Feedback is too long" }, { status: 400 });
    if (uploadIds.length > MAX_TICKET_IMAGES) return NextResponse.json({ error: `Attach up to ${MAX_TICKET_IMAGES} images` }, { status: 400 });

    const ticket = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const files = await claimUploads(tx, uploadIds, userId, "TICKET_ATTACHMENT");
      const created = await tx.report.create({
        data: {
          userId,
          type: "EARLY_ACCESS_FEEDBACK",
          reason: "Early Access feedback",
          description,
          attachments: { create: files.map((file) => ({ storedFileId: file.id })) },
        },
      });
      const notice = ticketReceivedNotification(created.type);
      await tx.notification.create({
        data: {
          userId,
          ...notice,
          type: "OTHER",
          category: "GENERAL",
          relatedId: created.id,
          relatedType: "report",
          actionUrl: `/tickets#${created.id}`,
        },
      });
      return created;
    });

    return NextResponse.json({ ok: true, ticketId: ticket.id }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadClaimError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("POST /api/tickets", error);
    return NextResponse.json({ error: "Feedback could not be sent" }, { status: 500 });
  }
}
