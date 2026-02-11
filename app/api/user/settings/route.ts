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
            defaultActiveMinutes: 45,
            defaultBreakMinutes: 15,
            defaultAutoBreak: true,
            emailNotifications: true,
            reminderNotifications: true,
            courseAlerts: true,
            profileVisibility: "public",
            activitySharing: true,
        });
    }

    return NextResponse.json({
        theme: settings.theme,
        defaultActiveMinutes: settings.defaultActiveMinutes,
        defaultBreakMinutes: settings.defaultBreakMinutes,
        defaultAutoBreak: settings.defaultAutoBreak,
        emailNotifications: settings.emailNotifications,
        reminderNotifications: settings.reminderNotifications,
        courseAlerts: settings.courseAlerts,
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

    // Build the data object from allowed fields
    const data: Record<string, unknown> = {};

    if (body.theme !== undefined) data.theme = body.theme;
    if (body.defaultActiveMinutes !== undefined)
        data.defaultActiveMinutes = Number(body.defaultActiveMinutes);
    if (body.defaultBreakMinutes !== undefined)
        data.defaultBreakMinutes = Number(body.defaultBreakMinutes);
    if (body.defaultAutoBreak !== undefined)
        data.defaultAutoBreak = Boolean(body.defaultAutoBreak);
    if (body.emailNotifications !== undefined)
        data.emailNotifications = Boolean(body.emailNotifications);
    if (body.reminderNotifications !== undefined)
        data.reminderNotifications = Boolean(body.reminderNotifications);
    if (body.courseAlerts !== undefined)
        data.courseAlerts = Boolean(body.courseAlerts);
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
        defaultActiveMinutes: settings.defaultActiveMinutes,
        defaultBreakMinutes: settings.defaultBreakMinutes,
        defaultAutoBreak: settings.defaultAutoBreak,
        emailNotifications: settings.emailNotifications,
        reminderNotifications: settings.reminderNotifications,
        courseAlerts: settings.courseAlerts,
        profileVisibility: settings.profileVisibility.toLowerCase(),
        activitySharing: settings.activitySharing,
    });
}
