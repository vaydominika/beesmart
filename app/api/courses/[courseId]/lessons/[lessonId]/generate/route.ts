import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canManageCourse } from "@/lib/course-access";
import { streamText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { createHash, randomUUID } from "node:crypto";
import { MalwareScanError, scanForMalware } from "@/lib/files/scanner";
import { deletePrivateFile, writePrivateFile } from "@/lib/files/storage";
import { UploadValidationError, validateUpload } from "@/lib/files/validation";

type RouteContext = { params: Promise<{ courseId: string; lessonId: string }> };

export const maxDuration = 60; // Allow up to 60 seconds for generation

export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, lessonId } = await ctx.params;

        // Verify ownership
        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }
        if (!await canManageCourse(courseId, userId)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        let prompt: string | undefined;
        let tone: string | undefined;
        let existingContent: string | undefined;
        let file: File | null = null;
        let isVisible = true;

        const contentType = req.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            prompt = formData.get("prompt")?.toString();
            tone = formData.get("tone")?.toString();
            existingContent = formData.get("existingContent")?.toString();
            file = formData.get("file") as File;
            isVisible = formData.get("isVisible") === "true";
        } else {
            const data = await req.json();
            prompt = data.prompt;
            tone = data.tone;
            existingContent = data.existingContent;
        }

        const lesson = await prisma.courseLesson.findFirst({
            where: { id: lessonId, module: { courseId } },
            include: { module: { select: { title: true } } }
        });

        if (!lesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        let extractedFileText = "";
        if (file) {
            const { extractTextFromFile } = await import("@/lib/ai/file-utils");
            const validated = await validateUpload(file, "COURSE_ATTACHMENT");
            const normalizedFile = new File([new Uint8Array(validated.buffer)], validated.originalName, { type: validated.detectedMime });
            extractedFileText = await extractTextFromFile(normalizedFile);
            const scanStatus = await scanForMalware(validated.buffer);
            const checksum = createHash("sha256").update(validated.buffer).digest("hex");
            const storageKey = `${checksum.slice(0, 2)}/${randomUUID()}`;
            await writePrivateFile(storageKey, validated.buffer);
            try {
                await prisma.storedFile.create({
                    data: {
                        ownerId: userId, purpose: "COURSE_ATTACHMENT", storageKey,
                        originalName: validated.originalName, detectedMime: validated.detectedMime,
                        fileType: validated.fileType, size: validated.size, checksum, scanStatus,
                        state: "ATTACHED", expiresAt: new Date("9999-12-31T23:59:59.000Z"),
                        courseFile: { create: {
                            lessonId, courseId, fileName: validated.originalName,
                            fileType: validated.fileType, fileSize: validated.size,
                            isVisible, uploadedById: userId,
                        } },
                    },
                });
            } catch (error) {
                await deletePrivateFile(storageKey);
                throw error;
            }
        }

        let systemPrompt = `You are an expert teacher and curriculum writer. 
You are writing a course lesson. 
Module Name: "${lesson.module.title}"
Lesson Request: "${prompt || lesson.title}"
${tone ? `Tone: ${tone}` : ''}
${extractedFileText ? `\n--- SOURCE MATERIAL FROM FILE ---\n${extractedFileText.substring(0, 20000)}\n--- END SOURCE MATERIAL ---` : ""}
Your goal is to write engaging, high-quality educational content formatted in clean, semantic HTML or Markdown that can be easily dropped into a TipTap rich text editor. Do NOT wrap the answer in a markdown code block. Just output the raw formatted text. Use bolding, lists, and headings appropriately.`;

        if (existingContent) {
            systemPrompt += `\n\nHere is the existing content for context:\n${existingContent}`;
        }

        const { checkContentSafety, flagContent } = await import("@/lib/ai/moderation");

        // Pre-check the prompt and existing content
        const inputToModerate = `Prompt: ${prompt || lesson.title}\n\nExisting: ${existingContent || ""}\n\nFile Text: ${extractedFileText.substring(0, 1000)}`;
        const inputSafety = await checkContentSafety(inputToModerate);

        if (!inputSafety.safe) {
            await flagContent(userId, courseId, "AI_INPUT_UNSAFE", inputSafety.reason);
            return NextResponse.json({ error: "Your request contains inappropriate content." }, { status: 400 });
        }

        const result = await streamText({
            model: deepseek("deepseek-chat"),
            system: systemPrompt,
            messages: [{ role: "user", content: `Please generate the lesson content for: ${lesson.title}` }],
        });

        // Use AI SDK's built-in Route Handler response
        return result.toTextStreamResponse();

    } catch (e) {
        if (e instanceof UploadValidationError) return NextResponse.json({ error: e.message }, { status: e.status });
        if (e instanceof MalwareScanError) return NextResponse.json({ error: e.message }, { status: e.infected ? 400 : 503 });
        console.error("POST /api/courses/[courseId]/lessons/[lessonId]/generate", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
