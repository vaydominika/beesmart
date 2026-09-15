import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import { getCurrentUserId, prisma } from "@/lib/db";
import { checkContentSafety } from "@/lib/ai/moderation";
import { AI_SOURCE_CHARACTER_LIMIT, AI_SOURCE_MIN_CHARACTER_LIMIT, type AiUsageState } from "@/lib/ai/usage-shared";
import { AiDailyLimitError, aiLimitResponse, reserveAiAttempt, withAiUsage } from "@/lib/ai/usage";
import { MalwareScanError, scanForMalware } from "@/lib/files/scanner";
import { UploadValidationError, validateUpload } from "@/lib/files/validation";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

const generatedTestSchema = (questionCount: number) => z.object({
  title: z.string().min(1).max(200),
  questions: z.array(z.object({
    text: z.string().min(1),
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"]),
    points: z.number().min(1).max(100).default(1),
    options: z.array(z.object({ text: z.string().min(1), isCorrect: z.boolean() })).max(6).optional(),
    correctAnswer: z.string().optional(),
  })).min(1).max(questionCount),
});

export async function POST(request: NextRequest, context: RouteContext) {
  let usage: AiUsageState | null = null;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id: classroomId } = await context.params;
    const membership = await prisma.classroomMember.findUnique({
      where: { userId_classroomId: { userId, classroomId } },
      select: { role: true },
    });
    if (!membership || membership.role === "STUDENT") {
      return NextResponse.json({ error: "Only teachers/TAs can generate tests" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let sourceText = "";
    let title = "";
    let difficulty = "Intermediate";
    let rawQuestionCount: FormDataEntryValue | number = 5;
    let sourceFiles: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      sourceText = String(formData.get("sourceText") ?? "").trim();
      title = String(formData.get("title") ?? "").trim().slice(0, 200);
      difficulty = String(formData.get("difficulty") ?? "Intermediate");
      rawQuestionCount = formData.get("questionCount") ?? 5;
      sourceFiles = formData.getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const legacyFileEntry = formData.get("file");
      if (sourceFiles.length === 0 && legacyFileEntry instanceof File && legacyFileEntry.size > 0) {
        sourceFiles = [legacyFileEntry];
      }
    } else {
      const body = await request.json();
      sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
      title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      difficulty = typeof body.difficulty === "string" ? body.difficulty : "Intermediate";
      rawQuestionCount = body.questionCount ?? 5;
    }
    const questionCount = Number.parseInt(String(rawQuestionCount), 10);

    if (sourceFiles.length === 0 && (sourceText.length < AI_SOURCE_MIN_CHARACTER_LIMIT || sourceText.length > AI_SOURCE_CHARACTER_LIMIT)) {
      return NextResponse.json({ error: `Source text must be between ${AI_SOURCE_MIN_CHARACTER_LIMIT} and ${AI_SOURCE_CHARACTER_LIMIT.toLocaleString()} characters` }, { status: 400 });
    }
    if (sourceFiles.length > 5) {
      return NextResponse.json({ error: "Choose up to 5 source files" }, { status: 400 });
    }
    if (sourceText.length > AI_SOURCE_CHARACTER_LIMIT) {
      return NextResponse.json({ error: `Source text must be ${AI_SOURCE_CHARACTER_LIMIT.toLocaleString()} characters or fewer` }, { status: 400 });
    }
    if (!Number.isFinite(questionCount) || questionCount < 1 || questionCount > 20) {
      return NextResponse.json({ error: "Question count must be between 1 and 20" }, { status: 400 });
    }
    if (!["Beginner", "Intermediate", "Advanced"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    const extractedSources: string[] = [];
    const supportedSourceTypes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
    ]);
    for (const sourceFile of sourceFiles) {
      const validated = await validateUpload(sourceFile, "COURSE_ATTACHMENT");
      if (!supportedSourceTypes.has(validated.detectedMime)) {
        return NextResponse.json({ error: "Source files must be PDF, DOCX, TXT, or CSV" }, { status: 400 });
      }
      await scanForMalware(validated.buffer);
      const { extractTextFromFile } = await import("@/lib/ai/file-utils");
      const extractedText = (await extractTextFromFile(new File(
        [new Uint8Array(validated.buffer)],
        validated.originalName,
        { type: validated.detectedMime },
      ))).trim();
      if (extractedText.length > AI_SOURCE_CHARACTER_LIMIT) {
        return NextResponse.json({ error: `${validated.originalName} contains more than ${AI_SOURCE_CHARACTER_LIMIT.toLocaleString()} characters. Shorten or split the file and try again.` }, { status: 400 });
      }
      if (extractedText) extractedSources.push(extractedText);
    }

    const sourceParts = [sourceText, ...extractedSources].filter(Boolean);
    const sourceCharacterCount = sourceParts.reduce((total, part) => total + part.length, 0);
    if (sourceCharacterCount < AI_SOURCE_MIN_CHARACTER_LIMIT) {
      return NextResponse.json({ error: `Source material must contain at least ${AI_SOURCE_MIN_CHARACTER_LIMIT} characters` }, { status: 400 });
    }
    if (sourceCharacterCount > AI_SOURCE_CHARACTER_LIMIT) {
      return NextResponse.json({ error: `Combined source material must be ${AI_SOURCE_CHARACTER_LIMIT.toLocaleString()} characters or fewer` }, { status: 400 });
    }
    const generationSource = sourceParts.join("\n\n--- SOURCE FILE ---\n\n");

    usage = await reserveAiAttempt(userId, "TEST_EXAM");

    const inputSafety = await checkContentSafety(generationSource);
    if (!inputSafety.safe) {
      return withAiUsage(NextResponse.json({ error: "The source text is not appropriate for test generation" }, { status: 400 }), usage);
    }

    const { object } = await generateObject({
      model: deepseek("deepseek-chat"),
      maxOutputTokens: 4000,
      schema: generatedTestSchema(questionCount),
      prompt: `Create an editable educational assessment from the supplied source text.
Generate exactly ${questionCount} questions at ${difficulty} difficulty.
Title: ${title || "Generated assessment"}
Use multiple choice, true/false, short-answer, and essay questions where appropriate. Multiple-choice questions must include one correct option. True/false and short-answer questions must include a correct answer.

Source text:
${generationSource}`,
    });

    const outputSafety = await checkContentSafety(JSON.stringify(object));
    if (!outputSafety.safe) {
      return withAiUsage(NextResponse.json({ error: "The generated test was flagged as inappropriate" }, { status: 400 }), usage);
    }

    return withAiUsage(NextResponse.json({ test: object }), usage);
  } catch (error) {
    if (error instanceof AiDailyLimitError) return aiLimitResponse(error);
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof MalwareScanError) return NextResponse.json({ error: error.message }, { status: error.infected ? 400 : 503 });
    console.error("POST generated test from text", error);
    return withAiUsage(NextResponse.json({ error: "Server error during test generation" }, { status: 500 }), usage);
  }
}
