import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import hu from "@/messages/hu.json";
import { createTextTranslator } from "./text";
import { resolveLocale } from "./config";
import { errorMessageTemplates } from "./error-messages";
describe("English and Hungarian catalogs", () => {
  it("has matching keys and formats every message without ICU errors", () => {
    expect(Object.keys(hu.UI).sort()).toEqual(Object.keys(en.UI).sort());
    for (const [locale, messages] of [["en", en], ["hu", hu]] as const) {
      const errors: unknown[] = [];
      const translate = createTranslator({ locale, messages: messages as { UI: Record<string, string> }, namespace: "UI", timeZone: "Europe/Budapest", onError: error => errors.push(error) });
      for (const [key, source] of Object.entries(en.UI)) {
        const values = Object.fromEntries([...source.matchAll(/\{(\w+)\}/g)].map(match => [match[1], 2]));
        translate(key, values);
      }
      expect(errors).toEqual([]);
    }
  });
  it("translates Hungarian text and preserves dynamic values", () => {
    const t = createTextTranslator(createTranslator({ locale: "hu", messages: hu as { UI: Record<string, string> }, namespace: "UI", timeZone: "Europe/Budapest" }));
    expect(t("Welcome back")).toBe("Üdv újra");
    expect(t("{v0} minutes", { v0: 45 })).toBe("45 perc");
    expect(t("Unknown wording")).toBe("Unknown wording");
    expect(t("Score must be between 0 and 100")).toBe("A pontszámnak 0 és 100 között kell lennie");
    expect(t("You have used all 3 AI attempts for this feature today.")).not.toContain("You have used");
  });
  it("only accepts supported locales", () => {
    expect(resolveLocale("hu")).toBe("hu");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("../hu")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
  it("formats activity and email catalogs in both languages", () => {
    for (const namespace of ["Activity", "Email"] as const) {
      expect(Object.keys(hu[namespace]).sort()).toEqual(Object.keys(en[namespace]).sort());
      for (const [locale, messages] of [["en", en], ["hu", hu]] as const) {
        const errors: unknown[] = [];
        const translate = createTranslator({ locale, messages: messages as Record<string, Record<string, string>>, namespace, onError: error => errors.push(error) });
        for (const [key, copy] of Object.entries(en[namespace])) {
          const values = Object.fromEntries([...copy.matchAll(/\{(\w+)\}/g)].map(match => [match[1], "https://example.com"]));
          translate(key, values);
        }
        expect(errors).toEqual([]);
      }
    }
  });
  it("rebuilds source lookups when an updated catalog adds a label", () => {
    const translate = (key: string) => key === "grades" ? "Értékelések" : "Hírfolyam";
    const original = createTextTranslator(translate, { feed: "Feed" });
    expect(original("Grades")).toBe("Grades");
    const updated = createTextTranslator(translate, { feed: "Feed", grades: "Grades" });
    expect(updated("Grades")).toBe("Értékelések");
  });
  it("translates server validation errors while preserving limits and filenames", () => {
    const t = createTextTranslator(createTranslator({ locale: "hu", messages: hu as { UI: Record<string, string> }, namespace: "UI" }));
    expect(t("File too large. Maximum size is 25 MB.")).toContain("25 MB");
    expect(t("File too large. Maximum size is 25 MB.")).not.toContain("File too large");
    expect(t("Failed to extract text from file: English lesson.pdf")).toContain("English lesson.pdf");
    expect(t("Source text must be between 100 and 5000 characters")).toContain("5000");
    const sources = new Set<string>(Object.values(en.UI));
    for (const template of errorMessageTemplates) expect(sources.has(template)).toBe(true);
  });
});
