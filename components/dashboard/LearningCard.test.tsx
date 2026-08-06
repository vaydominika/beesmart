import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LearningCard } from "./LearningCard";

describe("LearningCard ratings", () => {
  it("shows the public average and exposes rating for eligible learners", () => {
    const onRate = vi.fn();
    render(<LearningCard id="course-1" title="Biology" description="Cells" progress={60} averageRating={4.2} onRateClick={onRate} />);

    expect(screen.getByLabelText("4.2 out of 5 stars")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rate course" }));
    expect(onRate).toHaveBeenCalledWith("course-1");
  });

  it("keeps an informative rating row before the first review", () => {
    render(<LearningCard id="course-1" title="Biology" description="Cells" progress={60} averageRating={null} />);
    expect(screen.getByText("No ratings yet")).toBeInTheDocument();
  });
});
