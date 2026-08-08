import { NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";

async function getStats(userId: string) {
  const [focusCount, breakCount] = await Promise.all([
    prisma.focusSession.count({ where: { userId, type: "ACTIVE" } }),
    prisma.focusSession.count({ where: { userId, type: "BREAK" } }),
  ]);
  return { focusCount, breakCount };
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getStats(userId));
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const completionId = typeof body?.completionId === "string" ? body.completionId.trim() : "";
  const durationSeconds = Number(body?.durationSeconds);
  const type = body?.type === "break" ? "BREAK" : body?.type === "active" ? "ACTIVE" : null;
  const startedAt = new Date(body?.startedAt);
  const endedAt = new Date(body?.endedAt);

  if (
    !completionId || completionId.length > 191 || !type
    || !Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 7200
    || Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())
    || endedAt < startedAt
  ) {
    return NextResponse.json({ error: "Invalid completed focus session" }, { status: 400 });
  }

  const existing = await prisma.focusSession.findUnique({ where: { completionId } });
  if (existing) {
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Completion ID already used" }, { status: 409 });
    }
    return NextResponse.json({ session: existing, stats: await getStats(userId) });
  }

  try {
    const session = await prisma.focusSession.create({
      data: { userId, completionId, durationSeconds, type, startedAt, endedAt },
    });
    return NextResponse.json({ session, stats: await getStats(userId) }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      const duplicate = await prisma.focusSession.findUnique({ where: { completionId } });
      if (duplicate?.userId === userId) {
        return NextResponse.json({ session: duplicate, stats: await getStats(userId) });
      }
    }
    throw error;
  }
}
