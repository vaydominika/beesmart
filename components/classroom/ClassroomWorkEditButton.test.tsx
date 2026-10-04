import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test-utils/render";
import { LanguageStateProvider } from "@/components/i18n/LanguageProvider";
import { ClassroomWorkEditButton } from "./ClassroomWorkEditButton";

afterEach(() => vi.unstubAllGlobals());

describe("Hungarian classroom work actions", () => {
  it.each([
    ["assignment", "feladat", "Feladat", "ASSIGNMENT"],
    ["test", "teszt", "Teszt", "TEST"],
    ["exam", "vizsga", "Vizsga", "EXAM"],
  ] as const)("translates the %s menu and edit heading", async (kind, lowerLabel, label, type) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      title: "English authored title", description: "", type,
      deadlineAt: null, deadlineTimeZone: "Europe/Budapest", deadlineHasTime: false,
      isGraded: false, maxPoints: null, maxAttempts: 1, passingScore: 50,
      opensAt: null, closesAt: null, timeLimit: null,
    }), { status: 200 })));
    render(<LanguageStateProvider initialLocale="hu">
      <ClassroomWorkEditButton classroomId="class-1" title="English authored title" workType={kind}
        assignmentId={kind === "assignment" ? "assignment-1" : undefined}
        testId={kind !== "assignment" ? "test-1" : undefined} />
    </LanguageStateProvider>);
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    const edit = await screen.findByRole("menuitem", { name: `English authored title (${lowerLabel}) szerkesztése` });
    expect(screen.getByRole("menuitem", { name: `English authored title (${lowerLabel}) törlése` })).toBeVisible();
    fireEvent.click(edit);
    expect(await screen.findByRole("heading", { name: `${label} szerkesztése` })).toBeVisible();
    expect(await screen.findByDisplayValue("English authored title")).toBeVisible();
  });
});
