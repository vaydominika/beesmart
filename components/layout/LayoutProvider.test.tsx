import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LayoutProvider, useLayout } from "./LayoutProvider";

const responsive = vi.hoisted(() => ({ isMobile: false, hasRoom: false }));

vi.mock("./useIsMobile", () => ({
  useIsMobile: () => responsive.isMobile,
  useHasRoomForRightSidebar: () => responsive.hasRoom,
}));

function LayoutState() {
  const { isRightSidebarOpen } = useLayout();
  return <span>{isRightSidebarOpen ? "Right sidebar open" : "Right sidebar closed"}</span>;
}

describe("LayoutProvider responsive defaults", () => {
  beforeEach(() => {
    responsive.isMobile = false;
    responsive.hasRoom = false;
  });

  it("closes the right sidebar when there is not enough inline space", async () => {
    render(<LayoutProvider><LayoutState /></LayoutProvider>);
    await waitFor(() => expect(screen.getByText("Right sidebar closed")).toBeInTheDocument());
  });

  it("opens the right sidebar by default when the viewport has room", async () => {
    responsive.hasRoom = true;
    render(<LayoutProvider><LayoutState /></LayoutProvider>);
    await waitFor(() => expect(screen.getByText("Right sidebar open")).toBeInTheDocument());
  });
});
