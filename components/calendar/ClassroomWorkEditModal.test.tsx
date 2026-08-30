import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassroomWorkEditModal, classroomWorkDeleteEndpoint, classroomWorkKind } from "./ClassroomWorkEditModal";

afterEach(() => vi.unstubAllGlobals());

describe("ClassroomWorkEditModal", () => {
  it("resolves classroom-work labels and deletion endpoints", () => {
    const assignment = { id: "event-a", title: "Assignment: Essay", startDate: "2099-08-26T00:00:00.000Z", isAllDay: true, source: "classroom" as const, classroomId: "class-1", assignmentId: "assignment-1" };
    const exam = { id: "event-e", title: "Exam: Final", startDate: "2099-08-26T00:00:00.000Z", isAllDay: false, source: "classroom" as const, classroomId: "class-1", testId: "test-1" };

    expect(classroomWorkKind(assignment)).toBe("assignment");
    expect(classroomWorkDeleteEndpoint(assignment)).toBe("/api/classrooms/class-1/assignments/assignment-1");
    expect(classroomWorkKind(exam)).toBe("exam");
    expect(classroomWorkDeleteEndpoint(exam)).toBe("/api/classrooms/class-1/tests/test-1");
  });
  it("updates the assignment instead of its calendar event", async () => {
    const onUpdated = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/assignments/assignment-1") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ id: "assignment-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/assignments/assignment-1")) {
        return new Response(JSON.stringify({
          title: "Essay",
          description: "Read chapter four",
          deadlineAt: "2099-08-26T19:00:00.000Z",
          deadlineTimeZone: "Europe/Budapest",
          deadlineHasTime: true,
          isGraded: true,
          maxPoints: 100,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        id: "event-1",
        title: "Assignment: Revised essay",
        startDate: "2099-08-26T19:00:00.000Z",
        isAllDay: false,
        source: "classroom",
        classroomId: "class-1",
        assignmentId: "assignment-1",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ClassroomWorkEditModal
      open
      event={{ id: "event-1", title: "Assignment: Essay", startDate: "2099-08-26T19:00:00.000Z", isAllDay: false, source: "classroom", classroomId: "class-1", assignmentId: "assignment-1" }}
      onClose={vi.fn()}
      onUpdated={onUpdated}
    />);

    const title = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Revised essay" } });
    fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/classrooms/class-1/assignments/assignment-1",
      expect.objectContaining({ method: "PATCH" }),
    ));
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({ title: "Revised essay", isGraded: true, maxPoints: 100 });
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });

  it("shows assessment-specific settings for an exam", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      title: "Final",
      description: null,
      type: "EXAM",
      timeLimit: 90,
      passingScore: 60,
      opensAt: "2099-08-26T08:00:00.000Z",
      closesAt: "2099-08-26T10:00:00.000Z",
      maxAttempts: 1,
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    render(<ClassroomWorkEditModal
      open
      event={{ id: "event-2", title: "Exam: Final", startDate: "2099-08-26T08:00:00.000Z", isAllDay: false, source: "classroom", classroomId: "class-1", testId: "test-1" }}
      onClose={vi.fn()}
      onUpdated={vi.fn()}
    />);

    expect(await screen.findByRole("heading", { name: "Edit exam" })).toBeInTheDocument();
    expect(screen.getByLabelText("Opens")).toBeInTheDocument();
    expect(screen.getByLabelText("Closes")).toBeInTheDocument();
    expect(screen.getByLabelText("Time limit (min)")).toHaveValue(90);
    expect(screen.getByLabelText("Passing score (%)")).toHaveValue(60);
    expect(screen.getByLabelText("Attempts allowed")).toHaveValue(1);
  });

  it("saves from a classroom page without requiring a calendar event id", async () => {
    const onSaved = vi.fn();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(
      init?.method === "PATCH"
        ? { id: "assignment-1" }
        : {
          title: "Essay",
          description: null,
          deadlineAt: "2099-08-26T19:00:00.000Z",
          deadlineTimeZone: "Europe/Budapest",
          deadlineHasTime: true,
          isGraded: true,
          maxPoints: 20,
        },
    ), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ClassroomWorkEditModal
      open
      event={{ classroomId: "class-1", assignmentId: "assignment-1" }}
      onClose={vi.fn()}
      onSaved={onSaved}
    />);

    await screen.findByRole("textbox", { name: "Title" });
    fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/user/events"))).toBe(false);
  });

  it("uses the work description as the single message for an attached post", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({ id: "assignment-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        title: "Essay", description: null, deadlineAt: "2099-08-26T19:00:00.000Z",
        deadlineTimeZone: "Europe/Budapest", deadlineHasTime: true, isGraded: true, maxPoints: 20,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ClassroomWorkEditModal
      open
      event={{ classroomId: "class-1", assignmentId: "assignment-1" }}
      post={{ id: "post-1" }}
      onClose={vi.fn()}
    />);

    expect(await screen.findByRole("heading", { name: "Edit post" })).toBeInTheDocument();
    expect(await screen.findByText("Assignment details")).toBeInTheDocument();
    expect(screen.queryByText("Post message")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save post" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/classrooms/class-1/assignments/assignment-1",
      expect.objectContaining({ method: "PATCH" }),
    ));
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/posts/post-1"))).toBe(false);
  });
});
