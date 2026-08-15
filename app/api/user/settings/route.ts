import { NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

export async function GET() {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.userSettings.findUnique({
        where: { userId },
    });

    if (!settings) {
        // Return defaults matching the Prisma schema
        return NextResponse.json({
            theme: "bee",
            courseCreationTutorialCompleted: false,
            defaultActiveMinutes: 45,
            defaultBreakMinutes: 15,
            defaultAutoBreak: true,
            reminderNotifications: true,
            classroomNotifications: true,
            profileVisibility: "private",
            activitySharing: true,
        });
    }

    return NextResponse.json({
        theme: settings.theme,
        courseCreationTutorialCompleted: settings.courseCreationTutorialCompleted,
        defaultActiveMinutes: settings.defaultActiveMinutes,
        defaultBreakMinutes: settings.defaultBreakMinutes,
        defaultAutoBreak: settings.defaultAutoBreak,
        reminderNotifications: settings.reminderNotifications,
        classroomNotifications: settings.classroomNotifications,
        profileVisibility: settings.profileVisibility.toLowerCase(),
        activitySharing: settings.activitySharing,
    });
}

export async function PATCH(req: Request) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (body.reminderNotifications === true) {
        const current = await prisma.userSettings.findUnique({
            where: { userId },
            select: { reminderNotifications: true },
        });
        if (current?.reminderNotifications === false) {
            await prisma.reminder.updateMany({
                where: { userId, completed: false, notifyAt: { not: null, lte: new Date() }, notificationProcessedAt: null },
                data: { notificationProcessedAt: new Date() },
            });
        }
    }

    // Build the data object from allowed fields
    const data: Record<string, unknown> = {};

    if (body.theme !== undefined) data.theme = body.theme;
    // Completion is intentionally one-way: reviewing the tutorial never relocks course creation.
    if (body.courseCreationTutorialCompleted === true)
        data.courseCreationTutorialCompleted = true;
    if (body.defaultActiveMinutes !== undefined)
        data.defaultActiveMinutes = Number(body.defaultActiveMinutes);
    if (body.defaultBreakMinutes !== undefined)
        data.defaultBreakMinutes = Number(body.defaultBreakMinutes);
    if (body.defaultAutoBreak !== undefined)
        data.defaultAutoBreak = Boolean(body.defaultAutoBreak);
    if (body.reminderNotifications !== undefined)
        data.reminderNotifications = Boolean(body.reminderNotifications);
    if (body.classroomNotifications !== undefined)
        data.classroomNotifications = Boolean(body.classroomNotifications);
    if (body.profileVisibility !== undefined)
        data.profileVisibility =
            body.profileVisibility === "private" ? "PRIVATE" : "PUBLIC";
    if (body.activitySharing !== undefined)
        data.activitySharing = Boolean(body.activitySharing);

    const settings = await prisma.userSettings.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
    });

    return NextResponse.json({
        theme: settings.theme,
        courseCreationTutorialCompleted: settings.courseCreationTutorialCompleted,
        defaultActiveMinutes: settings.defaultActiveMinutes,
        defaultBreakMinutes: settings.defaultBreakMinutes,
        defaultAutoBreak: settings.defaultAutoBreak,
        reminderNotifications: settings.reminderNotifications,
        classroomNotifications: settings.classroomNotifications,
        profileVisibility: settings.profileVisibility.toLowerCase(),
        activitySharing: settings.activitySharing,
    });
}
