import type { TextTranslator } from "./text";

// Boolean options are system labels; multiple-choice answers remain authored text.
export function assessmentOptionText(questionType: string | undefined, source: string, t: TextTranslator) {
  if (questionType === "TRUE_FALSE") {
    if (source.toLowerCase() === "true") return t("True");
    if (source.toLowerCase() === "false") return t("False");
  }
  return source;
}
