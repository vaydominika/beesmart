import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

type ClassroomNotificationInput = {
    classroomId: string;
    actorId: string;
    title: string;
    body: string;
    type?: "ASSIGNMENT" | "REMINDER" | "EVENT" | "GRADE" | "INVITATION" | "OTHER";
    relatedId?: string;
    relatedType?: string;
    actionUrl?: string;
    includeActor?: boolean;
};

type ClassroomMemberRecipient = { userId: string };
type OptionalNotificationDb = {
    userSettings?: {
        findMany?: (args: unknown) => Promise<Array<{ userId: string }>>;
        findUnique?: (args: unknown) => Promise<{ classroomNotifications?: boolean } | null>;
    };
    classroom?: { findUnique?: (args: unknown) => Promise<unknown> };
    user?: { findUnique?: (args: unknown) => Promise<unknown> };
    notification: { create: (args: unknown) => Promise<unknown> };
};

async function disabledClassroomRecipientIds(userIds: string[]) {
    if (!userIds.length) return new Set<string>();
    const db = prisma as unknown as OptionalNotificationDb;
    if (!db.userSettings?.findMany) return new Set<string>();
    const disabled = await db.userSettings.findMany({
        where: { userId: { in: userIds }, classroomNotifications: false },
        select: { userId: true },
    });
    return new Set<string>(disabled.map((settings: { userId: string }) => settings.userId));
}

async function classroomNotificationsEnabled(userId: string) {
    const db = prisma as unknown as OptionalNotificationDb;
    if (!db.userSettings?.findUnique) return true;
    const settings = await db.userSettings.findUnique({
        where: { userId },
        select: { classroomNotifications: true },
    });
    return settings?.classroomNotifications !== false;
}

export async function notifyClassroomMembers(input: ClassroomNotificationInput) {
    const [classroom, actor, members] = await Promise.all([
        prisma.classroom.findUnique({ where: { id: input.classroomId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: input.actorId }, select: { name: true } }),
        prisma.classroomMember.findMany({ where: { classroomId: input.classroomId }, select: { userId: true } }),
    ]);

    if (!classroom || !actor) return;
    const candidates = input.includeActor ? members : members.filter((member: ClassroomMemberRecipient) => member.userId !== input.actorId);
    const disabledIds = await disabledClassroomRecipientIds(candidates.map((member: ClassroomMemberRecipient) => member.userId));
    const recipients = candidates.filter((member: ClassroomMemberRecipient) => !disabledIds.has(member.userId));
    if (!recipients.length) return;

    await prisma.notification.createMany({
        data: recipients.map((member: ClassroomMemberRecipient) => ({
            userId: member.userId,
            title: input.title,
            body: input.body,
            type: input.type ?? "OTHER",
            category: "CLASSROOM",
            classroomId: input.classroomId,
            classroomName: classroom.name,
            actorId: input.actorId,
            actorName: actor.name,
            relatedId: input.relatedId,
            relatedType: input.relatedType,
            actionUrl: input.actionUrl ?? `/classroom/${input.classroomId}`,
        })),
    });
}

export async function notifyClassroomUser(userId: string, input: ClassroomNotificationInput) {
    const db = prisma as unknown as OptionalNotificationDb;
    if (!await classroomNotificationsEnabled(userId)) return;
    if (!db.classroom?.findUnique || !db.user?.findUnique) {
        await db.notification.create({
            data: {
                userId, title: input.title, body: input.body, type: input.type ?? "OTHER",
                category: "CLASSROOM", classroomId: input.classroomId,
                actorId: input.actorId, relatedId: input.relatedId,
                relatedType: input.relatedType, actionUrl: input.actionUrl,
            },
        });
        return;
    }
    const [classroom, actor] = await Promise.all([
        prisma.classroom.findUnique({ where: { id: input.classroomId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: input.actorId }, select: { name: true } }),
    ]);
    if (!classroom || !actor) return;
    await prisma.notification.create({
        data: {
            userId,
            title: input.title,
            body: input.body,
            type: input.type ?? "OTHER",
            category: "CLASSROOM",
            classroomId: input.classroomId,
            classroomName: classroom.name,
            actorId: input.actorId,
            actorName: actor.name,
            relatedId: input.relatedId,
            relatedType: input.relatedType,
            actionUrl: input.actionUrl ?? `/classroom/${input.classroomId}`,
        },
    });
}

export async function materializeDueReminderNotifications(userId: string) {
    const now = new Date();
    const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { reminderNotifications: true },
    });
    const due = await prisma.reminder.findMany({
        where: {
            userId,
            completed: false,
            notifyAt: { not: null, lte: now },
            notificationProcessedAt: null,
        },
        orderBy: { notifyAt: "asc" },
    });
    if (!due.length) return [];

    if (settings?.reminderNotifications === false) {
        await prisma.reminder.updateMany({
            where: { id: { in: due.map((reminder: { id: string }) => reminder.id) }, notificationProcessedAt: null },
            data: { notificationProcessedAt: now },
        });
        return [];
    }

    const triggered: Array<{ id: string; task: string }> = [];
    for (const reminder of due) {
        const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const claimed = await tx.reminder.updateMany({
                where: { id: reminder.id, userId, completed: false, notificationProcessedAt: null },
                data: { notificationProcessedAt: now },
            });
            if (claimed.count !== 1) return false;
            await tx.notification.create({
                data: {
                    userId,
                    title: "Reminder",
                    body: reminder.task,
                    type: "REMINDER",
                    category: "GENERAL",
                    relatedId: reminder.eventId,
                    relatedType: "event",
                    actionUrl: `/dashboard?event=${reminder.eventId}`,
                },
            });
            return true;
        });
        if (created) triggered.push({ id: reminder.id, task: reminder.task });
    }
    return triggered;
}
