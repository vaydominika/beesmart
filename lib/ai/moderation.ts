import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import { prisma } from "@/lib/db";

export interface ModerationResult {
    safe: boolean;
    reason?: string;
    flaggedCategories?: string[];
}

/**
 * Checks content for safety (nudity, cussing, hate speech, etc.)
 */
export async function checkContentSafety(content: string): Promise<ModerationResult> {
    try {
        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: z.object({
                safe: z.boolean().describe("True if the content is appropriate for an educational platform"),
                reason: z.string().optional().describe("Why the content was flagged, if unsafe"),
                flaggedCategories: z.array(z.string()).optional().describe("Categories of safety violation (e.g., Profanity, Explicit, Hate Speech)"),
            }),
            system: "You are a content moderation AI for an educational platform called beesmart. Your goal is to ensure all content is safe for students and teachers. Flag anything containing profanity, explicit sexual content, hate speech, or harmful/illegal advice.",
            prompt: `Analyze the following content for safety and appropriateness:\n\n"${content}"`,
        });

        return object;
    } catch (error) {
        console.error("Moderation check failed:", error);
        // If moderation fails, we default to safe but log the error, 
        // or we could default to unsafe for maximum security.
        // For now, let's assume safe to avoid blocking users due to API issues.
        return { safe: true };
    }
}

/**
 * Creates a system report for flagged content
 */
export async function flagContent(userId: string, courseId: string, reason: string, details?: string) {
    return await prisma.report.create({
        data: {
            userId,
            courseId,
            reason: `AI_FLAG: ${reason}`,
            description: details,
            status: "PENDING",
        },
    });
}
