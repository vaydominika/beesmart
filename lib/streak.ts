import { prisma } from "@/lib/db";

/**
 * Updates the user's learning streak based on their activity.
 * Logic:
 * - If first activity ever: Start streak at 1.
 * - If already active today: Do nothing.
 * - If last activity was yesterday: Increment streak.
 * - If gap detected (last activity before yesterday): Reset streak to 1.
 */
export async function updateUserStreak(userId: string) {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const streak = await prisma.streak.findUnique({
        where: { userId },
    });

    if (!streak) {
        return await prisma.streak.create({
            data: {
                userId,
                currentStreak: 1,
                longestStreak: 1,
                lastActivityDate: now,
            },
        });
    }

    const lastActivity = streak.lastActivityDate;
    if (!lastActivity) {
        return await prisma.streak.update({
            where: { userId },
            data: {
                currentStreak: 1,
                longestStreak: Math.max(1, streak.longestStreak),
                lastActivityDate: now,
            },
        });
    }

    const lastActivityStr = lastActivity.toISOString().split("T")[0];

    if (lastActivityStr === todayStr) {
        // Already recorded activity for today
        return streak;
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = 1;
    if (lastActivityStr === yesterdayStr) {
        newStreak = streak.currentStreak + 1;
    }

    const newLongest = Math.max(newStreak, streak.longestStreak);

    return await prisma.streak.update({
        where: { userId },
        data: {
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastActivityDate: now,
        },
    });
}
