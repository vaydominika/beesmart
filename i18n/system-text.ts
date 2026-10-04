import type { TextTranslator } from "./text";

function matchTemplate(source: string, template: string, t: TextTranslator): string | null {
  const names: string[] = [];
  const pattern = template.split(/(\{\w+\})/).map((part) => {
    if (/^\{\w+\}$/.test(part)) {
      names.push(part.slice(1, -1));
      return "([\\s\\S]*)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  const match = new RegExp(`^${pattern}$`).exec(source);
  if (!match) return null;
  return t(template, Object.fromEntries(names.map((name, index) => [name, match[index + 1]])));
}

// Stored system messages keep English templates in the database. Translate only
// known templates; resource names and user-authored notification bodies stay intact.
const notificationTemplates: Record<string, readonly string[]> = {
  "Post updated": ["{title} was edited."],
  "Course added": ["{title} was added to the Classroom."],
  "Test date removed": ["{title} is no longer scheduled."],
  "Test rescheduled": ["{title} was changed in the calendar."],
  "Assignment graded": ['Your submission for "{title}" was graded: {score}/{maximum}'],
  "Assignment updated": ["{title} was changed or rescheduled."],
  "Assignment removed": ["{title} was removed from the Classroom."],
  "Added to classroom": ['You were added to "{title}"'],
  "New exam": ["{title} was scheduled.", "{title} was created."],
  "New test": ["{title} was scheduled.", "{title} was created."],
  "Course created": ["{title} is ready for you to build."],
  "Course published": ["{title} is now published."],
  "Course completed": ["You completed {title}."],
  "Assessment graded": ["{title} was graded: {score}%"],
  "Test graded": ["Your {title} was graded: {score}%"],
  "Exam updated": ["{title} was changed or rescheduled."],
  "Test updated": ["{title} was changed or rescheduled."],
  "Exam removed": ["{title} was removed from the Classroom."],
  "Test removed": ["{title} was removed from the Classroom."],
  "Report status updated": ["Your report is now {status}."],
  "Report resolved": ["Your report is now {status}."],
  "Report closed": ["Your report is now {status}."],
};

export function translateNotificationBody(title: string, body: string, t: TextTranslator): string {
  for (const template of notificationTemplates[title] ?? []) {
    const result = matchTemplate(body, template, (source, values) => t(source, values && {
      ...values,
      ...(values.status ? { status: t(String(values.status)) } : {}),
    }));
    if (result !== null) return result;
  }
  if (["Report received", "Course invitation"].includes(title)) return t(body);
  if (title === "Post updated" && body === "A classroom post was edited.") return t(body);
  if (title === "New Classroom material" && body === "A file was shared.") return t(body);
  return body;
}

export function translateAuditReason(reason: string, t: TextTranslator): string {
  for (const template of ["The module “{title}” has no lessons.", "The lesson “{title}” has no content."]) {
    const result = matchTemplate(reason, template, t);
    if (result !== null) return result;
  }
  return t(reason);
}
