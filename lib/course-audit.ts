import { z } from "zod";

const lessonReferenceSchema = z.string().nullable().optional().describe(
  "Exact lesson ID from the supplied course content, or null for a course-wide or module-wide finding",
);

export const courseAuditSchema = z.object({
  overallScore: z.number().min(0).max(100).describe("Overall pedagogical quality score"),
  summary: z.string().describe("Executive summary of the course audit"),
  strengths: z.array(z.string()).describe("List of positive aspects found in the course"),
  qualityIssues: z.array(z.object({
    lessonId: lessonReferenceSchema,
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    issue: z.string(),
    suggestion: z.string(),
  })).describe("Potential pedagogical or structural improvements"),
  safetyFlags: z.array(z.object({
    lessonId: lessonReferenceSchema,
    contentSnippet: z.string(),
    reason: z.string(),
  })).describe("Any potential violations of the safety policy"),
  accessibilityScore: z.number().min(0).max(100).describe("Estimate of content accessibility (structure, clarity)"),
});

export type CourseAudit = z.infer<typeof courseAuditSchema>;
