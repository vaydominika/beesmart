import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test-utils/render";
import { LanguageStateProvider } from "@/components/i18n/LanguageProvider";
import ClassroomDetailPage from "./page";
import type { ReactNode } from "react";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("framer-motion", () => ({ motion: { span: ({ children }: { children?: ReactNode }) => <span>{children}</span> } }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ id: "class-1" }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/classroom/ClassroomFeed", () => ({ ClassroomFeed: () => <div>Feed content</div> }));
vi.mock("@/components/classroom/ClassroomPeople", () => ({ ClassroomPeople: () => <div>People content</div> }));
vi.mock("@/components/classroom/ClassroomGradebook", () => ({ ClassroomGradebook: () => <div>Grades content</div> }));
vi.mock("@/components/classroom/ClassroomSettings", () => ({ ClassroomSettings: () => null }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("translates classroom tabs while preserving navigation values", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    id: "class-1", name: "English authored classroom", code: "CLASS1", role: "STUDENT",
    creator: { id: "teacher", name: "Teacher" }, _count: { members: 2, posts: 1 },
  }) }));
  render(<LanguageStateProvider initialLocale="hu"><ClassroomDetailPage /></LanguageStateProvider>);
  expect(await screen.findByRole("button", { name: "Hírfolyam" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Feed" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tagok" }));
  expect(router.replace).toHaveBeenLastCalledWith("/classroom/class-1?tab=People", { scroll: false });
  expect(screen.getByText("People content")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Értékelések" }));
  expect(router.replace).toHaveBeenLastCalledWith("/classroom/class-1?tab=Grades", { scroll: false });
  expect(screen.getByText("Grades content")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Hírfolyam" }));
  expect(router.replace).toHaveBeenLastCalledWith("/classroom/class-1", { scroll: false });
});
