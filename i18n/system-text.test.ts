import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import hu from "@/messages/hu.json";
import { createTextTranslator } from "./text";
import { translateAuditReason, translateNotificationBody } from "./system-text";

const t = createTextTranslator(createTranslator({ locale: "hu", messages: hu as { UI: Record<string, string> }, namespace: "UI", timeZone: "Europe/Budapest" }));

describe("stored system text", () => {
  it("translates notifications and preserves course titles and scores", () => {
    expect(translateNotificationBody("Assignment graded", 'Your submission for "English grammar" was graded: 18/20', t)).toBe('A(z) „English grammar” feladatra beadott munkád értékelése: 18/20');
    expect(translateNotificationBody("Report closed", "Your report is now closed.", t)).toBe("A jelentésed jelenlegi állapota: lezárva.");
  });
  it("preserves user-authored posts and reminder bodies", () => {
    const body = "You completed English grammar.";
    expect(translateNotificationBody("New Classroom post", body, t)).toBe(body);
    expect(translateNotificationBody("Reminder", body, t)).toBe(body);
  });
  it("localizes edited-post and shared-file system messages", () => {
    expect(translateNotificationBody("Post updated", "English grammar was edited.", t)).toBe("A(z) English grammar bejegyzést szerkesztették.");
    expect(translateNotificationBody("New Classroom material", "A file was shared.", t)).toBe("Megosztottak egy fájlt.");
    expect(translateNotificationBody("New Classroom material", "English authored post", t)).toBe("English authored post");
  });
  it("translates audit blockers without translating authored module names", () => {
    expect(translateAuditReason("The module “Public” has no lessons.", t)).toBe("A(z) „Public” modulban nincsenek leckék.");
    expect(translateAuditReason("The course has no modules.", t)).toBe("A kurzusnak nincsenek moduljai.");
  });
});
