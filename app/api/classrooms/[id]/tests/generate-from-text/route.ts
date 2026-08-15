import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import { getCurrentUserId, prisma } from "@/lib/db";
import { checkContentSafety } from "@/lib/ai/moderation";
import { AI_SOURCE_CHARACTER_LIMIT, type AiUsageState } from "@/lib/ai/usage-shared";
import { AiDailyLimitError, aiLimitResponse, reserveAiAttempt, withAiUsage } from "@/lib/ai/usage";

type RouteContext = { params: Promise<{ id: string }> };

const generatedTestSchema = (questionCount: number) => z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
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

    const body = await request.json();
    const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";
    const difficulty = typeof body.difficulty === "string" ? body.difficulty : "Intermediate";
    const questionCount = Number.parseInt(String(body.questionCount ?? 5), 10);

    if (sourceText.length < 50 || sourceText.length > AI_SOURCE_CHARACTER_LIMIT) {
      return NextResponse.json({ error: `Source text must be between 50 and ${AI_SOURCE_CHARACTER_LIMIT.toLocaleString()} characters` }, { status: 400 });
    }
    if (!Number.isFinite(questionCount) || questionCount < 1 || questionCount > 20) {
      return NextResponse.json({ error: "Question count must be between 1 and 20" }, { status: 400 });
    }
    if (!["Beginner", "Intermediate", "Advanced"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    usage = await reserveAiAttempt(userId, "TEST_EXAM");

    const inputSafety = await checkContentSafety(sourceText);
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
Description: ${description || "An assessment generated from provided lesson material."}
Use multiple choice, true/false, short-answer, and essay questions where appropriate. Multiple-choice questions must include one correct option. True/false and short-answer questions must include a correct answer.

Source text:
${sourceText}`,
    });

    const outputSafety = await checkContentSafety(JSON.stringify(object));
    if (!outputSafety.safe) {
      return withAiUsage(NextResponse.json({ error: "The generated test was flagged as inappropriate" }, { status: 400 }), usage);
    }

    return withAiUsage(NextResponse.json({ test: object, courseId: null }), usage);
  } catch (error) {
    if (error instanceof AiDailyLimitError) return aiLimitResponse(error);
    console.error("POST generated test from text", error);
    return withAiUsage(NextResponse.json({ error: "Server error during test generation" }, { status: 500 }), usage);
  }
}
