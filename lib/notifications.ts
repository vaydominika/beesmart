import { prisma } from "@/lib/db";

type ClassroomNotificationInput = {
    classroomId: string;
    actorId: string;
    title: string;
    body: string;
    type?: "ASSIGNMENT" | "REMINDER" | "ANNOUNCEMENT" | "EVENT" | "GRADE" | "INVITATION" | "OTHER";
    relatedId?: string;
    relatedType?: string;
    actionUrl?: string;
    includeActor?: boolean;
};

export async function notifyClassroomMembers(input: ClassroomNotificationInput) {
    const [classroom, actor, members] = await Promise.all([
        prisma.classroom.findUnique({ where: { id: input.classroomId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: input.actorId }, select: { name: true } }),
        prisma.classroomMember.findMany({ where: { classroomId: input.classroomId }, select: { userId: true } }),
    ]);

    if (!classroom || !actor) return;
    const recipients = input.includeActor ? members : members.filter((member: any) => member.userId !== input.actorId);
    if (!recipients.length) return;

    await prisma.notification.createMany({
        data: recipients.map((member: any) => ({
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
    const db = prisma as any;
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
