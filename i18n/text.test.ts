import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import hu from "@/messages/hu.json";
import { createTextTranslator } from "./text";
import { resolveLocale } from "./config";
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
  });
  it("only accepts supported locales", () => {
    expect(resolveLocale("hu")).toBe("hu");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("../hu")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});
