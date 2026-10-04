export const errorMessageTemplates = [
  "Score must be between 0 and {maximum}",
  "Source material must contain at least {minimum} characters",
  "AI grading supports up to {maximum} essays per attempt",
  "Choose up to {maximum} valid course tags.",
  "Course title must be {maximum} characters or fewer.",
  "You have used all {maximum} AI attempts for this feature today.",
  "Attach up to {maximum} images",
  "Source text must be {maximum} characters or fewer",
  "The source file contains more than {maximum} characters. Shorten or split the file and try again.",
  "Combined source material must be {maximum} characters or fewer",
  "Source text must be between {minimum} and {maximum} characters",
  "{file} contains more than {maximum} characters. Shorten or split the file and try again.",
  "Essay questions must be {maximum} characters or fewer for AI grading",
  "Essay responses must be {maximum} characters or fewer for AI grading",
  "AI grading context must total {maximum} characters or fewer per attempt",
  "Lesson prompts must be {maximum} characters or fewer",
  "Essay responses must be {maximum} characters or fewer",
  "Short answer responses must be {maximum} characters or fewer",
  "Written responses for one attempt must total {maximum} characters or fewer",
  "File too large. Maximum size is {maximum} MB.",
  "Failed to extract text from file: {file}",
] as const;

const errorPatterns = errorMessageTemplates.map(template => {
  const names: string[] = [];
  const expression = template.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) {
      names.push(part.slice(1, -1));
      return "([\\s\\S]*)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { template, names, pattern: new RegExp(`^${expression}$`) };
});

export function matchErrorMessage(source: string) {
  for (const { template, names, pattern } of errorPatterns) {
    const match = pattern.exec(source);
    if (match) return { template, values: Object.fromEntries(names.map((name, index) => [name, match[index + 1]])) };
  }
  return null;
}
