import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BasedOnYourCoursesCard } from "./BasedOnYourCoursesCard";
import { SurpriseMeCard } from "./SurpriseMeCard";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const recommendation = {
  kind: "HIVE_PICK",
  generatedAt: "2026-08-22T12:00:00.000Z",
  resetsAt: "2026-08-23T00:00:00.000Z",
  cached: false,
  course: {
    id: "course-2",
    title: "Genetics",
    description: "Genes and inheritance",
    coverImageUrl: null,
    averageRating: 4.5,
  },
};

describe("daily course recommendation cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("opens today's hive pick and navigates to the selected course", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(recommendation), { status: 200 }));
    render(<BasedOnYourCoursesCard />);

    fireEvent.click(screen.getByRole("button", { name: /See today's pick/i }));

    expect(await screen.findByRole("heading", { name: "Genetics" })).toBeInTheDocument();
    expect(screen.getByText("Chosen to build on courses you've already completed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open course" }));
    expect(router.push).toHaveBeenCalledWith("/courses/course-2");
  });

  it("keeps protected recommendations on the dashboard and scrolls to Discover", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      code: "COURSE_COMPLETION_REQUIRED",
      error: "Finish one course to unlock daily course picks.",
    }), { status: 409 }));
    const scrollIntoView = vi.fn();
    render(
      <>
        <BasedOnYourCoursesCard />
        <div id="discover" ref={(element) => {
          if (element) element.scrollIntoView = scrollIntoView;
        }} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /See today's pick/i }));

    expect(await screen.findByRole("heading", { name: "Complete your first course" })).toBeInTheDocument();
    expect(screen.getByText("Finish one course to unlock daily course picks.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse courses" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("uses the separate try-something-new recommendation type", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ...recommendation,
      kind: "TRY_SOMETHING_NEW",
    }), { status: 200 }));
    render(<SurpriseMeCard />);

    fireEvent.click(screen.getByRole("button", { name: /Surprise me/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/dashboard/recommendations/TRY_SOMETHING_NEW",
      { method: "POST" },
    ));
    expect(await screen.findByText("Chosen to take you into a different subject.")).toBeInTheDocument();
  });
});
