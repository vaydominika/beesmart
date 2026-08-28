import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClassroomPage from "./page";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/components/classroom/ClassroomCard", () => ({
  ClassroomCard: ({ name, onClick }: { name: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>{name}</button>
  ),
}));

vi.mock("@/components/classroom/CreateClassroomModal", () => ({
  CreateClassroomModal: () => null,
}));

vi.mock("@/components/classroom/JoinClassroomModal", () => ({
  JoinClassroomModal: () => null,
}));

const classrooms = [
  {
    id: "joined-1",
    name: "Biology class",
    description: "Cells and organisms",
    code: "BIO123",
    subject: "Biology",
    role: "STUDENT",
    memberCount: 12,
    creatorName: "Ada",
    createdAt: "2026-08-01T08:00:00.000Z",
    isOwner: false,
  },
  {
    id: "created-1",
    name: "Physics lab",
    description: "Motion and energy",
    code: "PHY123",
    subject: "Physics",
    role: "TEACHER",
    memberCount: 8,
    creatorName: "My Lady",
    createdAt: "2026-08-02T08:00:00.000Z",
    isOwner: true,
  },
];

describe("ClassroomPage navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    router.push.mockReset();
  });

  it("separates joined and created classrooms and filters the active tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => classrooms,
    }));

    render(<ClassroomPage />);

    expect(await screen.findByRole("button", { name: "Biology class" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Physics lab" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Joined" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Created" }));

    expect(screen.getByRole("button", { name: "Physics lab" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Biology class" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Classrooms you created" })).toBeInTheDocument();
    expect(window.localStorage.getItem("classrooms-active-tab")).toBe("created");

    fireEvent.change(screen.getByRole("textbox", { name: "Search classrooms" }), { target: { value: "missing" } });
    expect(screen.getByText("No classrooms match these filters")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("button", { name: "Physics lab" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Classroom role: All roles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join classroom" })).toBeInTheDocument();
  });

  it("restores the previously selected tab on the next visit", async () => {
    window.localStorage.setItem("classrooms-active-tab", "joined");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => classrooms.filter((classroom) => classroom.isOwner),
    }));

    render(<ClassroomPage />);

    expect(await screen.findByRole("tab", { name: "Joined" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("No joined classrooms yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Physics lab" })).not.toBeInTheDocument();
  });

  it("opens a classroom from its card", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => classrooms,
    }));

    render(<ClassroomPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Biology class" }));
    expect(router.push).toHaveBeenCalledWith("/classroom/joined-1");
  });
});
