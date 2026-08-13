import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/types";
import { MainContent } from "./MainContent";

const dashboardMock = vi.hoisted(() => ({
  state: {} as {
    data: DashboardData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
  },
}));

vi.mock("@/lib/DashboardContext", () => ({
  useDashboard: () => dashboardMock.state,
}));

vi.mock("./CourseRail", () => ({
  CourseRail: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title}><h2>{title}</h2>{children}</section>
  ),
}));

vi.mock("./LearningCard", () => ({
  LearningCard: ({ title }: { title: string }) => <article>{title}</article>,
}));

vi.mock("./ReportCourseModal", () => ({ ReportCourseModal: () => null }));
vi.mock("@/components/course/CourseRatingModal", () => ({ CourseRatingModal: () => null }));

const card = (id: string, title: string, description: string | null = null) => ({
  id,
  title,
  description,
  coverImageUrl: null,
  averageRating: null,
});
const data: DashboardData = {
  user: null,
  streak: 0,
  myCourses: [card("mine", "Writing workshop")],
  continueLearning: [card("continue", "Biology", "<p>Living cells and systems</p>")],
  popularCourses: [card("popular", "Popular physics")],
  finishedCourses: [card("finished", "World history")],
  discoverCourses: [card("discover", "Drawing basics")],
};

describe("MainContent dashboard filtering", () => {
  beforeEach(() => {
    dashboardMock.state = { data, loading: false, error: null, refetch: vi.fn() };
  });

  it("keeps all course rails when no search is active", () => {
    render(<MainContent searchQuery="" onClearSearch={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Your courses" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Continue learning" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Popular now" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Finished" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discover" })).toBeInTheDocument();
  });

  it("filters each rail by title or plain-text description and hides empty rails", () => {
    render(<MainContent searchQuery="living cells" onClearSearch={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Continue learning" })).toBeInTheDocument();
    expect(screen.getByText("Biology")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your courses" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Discover" })).not.toBeInTheDocument();
  });

  it("shows one no-results state and clears the query through its action", () => {
    const onClearSearch = vi.fn();
    render(<MainContent searchQuery="quantum beekeeping" onClearSearch={onClearSearch} />);

    expect(screen.getByText("No courses match “quantum beekeeping”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClearSearch).toHaveBeenCalledOnce();
  });
});
