import { fireEvent, render, screen, waitFor } from "@/test-utils/render";
import { describe, expect, it, vi } from "vitest";
import { LanguageStateProvider } from "./LanguageProvider";
import { LanguageSelect } from "./LanguageSelect";
import { useText } from "@/i18n/use-text";
import { CalendarWidget } from "@/components/layout/CalendarWidget";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
function Probe() { const t = useText(); return <><LanguageSelect /><p>{t("Welcome back")}</p><p>{t("{v0} minutes", { v0: 45 })}</p></>; }
describe("language switching", () => {
  it("switches immediately, remembers a cookie, and refreshes server content", async () => {
    const refresh = vi.fn();
    render(<LanguageStateProvider initialLocale="en" refresh={refresh}><Probe /></LanguageStateProvider>);
    expect(screen.getByText("Welcome back")).toBeVisible();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Language: English" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Magyar" }));
    expect(screen.getByText("Üdv újra")).toBeVisible();
    expect(screen.getByText("45 perc")).toBeVisible();
    expect(document.cookie).toContain("beesmart-locale=hu");
    await waitFor(() => expect(document.documentElement.lang).toBe("hu"));
    expect(refresh).toHaveBeenCalledOnce();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Nyelv: Magyar" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "English" }));
    expect(screen.getByText("Welcome back")).toBeVisible();
    expect(document.cookie).toContain("beesmart-locale=en");
  });
  it("localizes calendar headers and preserves user-authored option names", () => {
    render(<LanguageStateProvider initialLocale="hu"><CalendarWidget /><WorkspaceSelect ariaLabel="Tanterem" value="one" options={[{value: "one", label: "Public"}]} onValueChange={() => {}} /></LanguageStateProvider>);
    expect(screen.getByText("H")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ma" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tanterem: Public" })).toBeVisible();
  });
});
