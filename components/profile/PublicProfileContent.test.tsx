import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfileContent, type PublicProfileData } from "./PublicProfileContent";

function buildProfile(): PublicProfileData {
  return {
    id: "user-1",
    name: "Dominika Vay",
    avatar: null,
    bannerImageUrl: null,
    joinedAt: "2026-04-29T00:00:00.000Z",
    isOwner: true,
    isPrivate: true,
    activitySharing: true,
    courses: Array.from({ length: 15 }, (_, index) => ({
      id: `course-${index + 1}`,
      title: `Course ${index + 1}`,
      description: null,
      coverImageUrl: null,
      updatedAt: "2026-08-01T00:00:00.000Z",
    })),
    activity: Array.from({ length: 14 }, (_, index) => ({
      id: `activity-${index + 1}`,
      text: `Activity ${index + 1}`,
      createdAt: "2026-08-01T00:00:00.000Z",
      actionUrl: index === 0 ? "/courses/course-1" : null,
    })),
  };
}

describe("PublicProfileContent", () => {
  it("previews the latest 12 courses and 9 activities, then reveals and closes the rest", () => {
    render(<PublicProfileContent profile={buildProfile()} />);

    expect(screen.getByText("Your profile is private")).toBeInTheDocument();
    expect(screen.getByText("Course 12")).toBeInTheDocument();
    expect(screen.queryByText("Course 13")).not.toBeInTheDocument();
    expect(screen.getByText("Activity 9")).toBeInTheDocument();
    expect(screen.queryByText("Activity 10")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Activity 1/ })).toHaveAttribute(
      "href",
      "/courses/course-1",
    );

    fireEvent.click(screen.getByRole("button", { name: "3 more" }));
    expect(screen.getByText("Course 15")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close courses" }));
    expect(screen.queryByText("Course 13")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "5 more" }));
    expect(screen.getByText("Activity 14")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close activity" }));
    expect(screen.queryByText("Activity 10")).not.toBeInTheDocument();
  });
});
