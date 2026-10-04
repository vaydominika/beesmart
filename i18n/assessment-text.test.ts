import { expect, it } from "vitest";
import { createTranslator } from "next-intl";
import hu from "@/messages/hu.json";
import { createTextTranslator } from "./text";
import { assessmentOptionText } from "./assessment-text";

it("localizes boolean options without translating authored multiple-choice answers", () => {
  const t = createTextTranslator(createTranslator({ locale: "hu", messages: hu as { UI: Record<string, string> }, namespace: "UI" }));
  expect(assessmentOptionText("TRUE_FALSE", "True", t)).toBe("Igaz");
  expect(assessmentOptionText("TRUE_FALSE", "false", t)).toBe("Hamis");
  expect(assessmentOptionText("MULTIPLE_CHOICE", "True", t)).toBe("True");
  expect(assessmentOptionText("TRUE_FALSE", "An authored answer", t)).toBe("An authored answer");
});
