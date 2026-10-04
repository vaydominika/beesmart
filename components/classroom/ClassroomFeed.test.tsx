import { fireEvent, render, screen, waitFor } from "@/test-utils/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassroomFeed } from "./ClassroomFeed";

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("@/components/ui/sonner", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));

vi.mock("next/image", () => ({
  default: ({ alt }: React.ImgHTMLAttributes<HTMLImageElement>) => <span role="img" aria-label={alt} />,
}));

vi.mock("@/components/ui/editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

vi.mock("@/components/classroom/CreateAssignmentModal", () => ({ CreateAssignmentModal: () => null }));
vi.mock("@/components/classroom/CreateTestModal", () => ({ CreateTestModal: () => null }));
vi.mock("@/components/classroom/TestPreviewModal", () => ({
  TestPreviewModal: ({ open, testId }: { open: boolean; testId: string | null }) => open ? <div>Assessment preview {testId}</div> : null,
}));
vi.mock("@/components/calendar/ClassroomWorkEditModal", () => ({ ClassroomWorkEditModal: () => null }));
vi.mock("@/components/calendar/DeleteConfirmationModal", () => ({ DeleteConfirmationModal: () => null }));
vi.mock("@/components/classroom/CoursePostModal", () => ({ CoursePostModal: () => null }));
vi.mock("@/hooks/use-event-sync", () => ({ useEventSync: () => ({ triggerUpdate: vi.fn() }) }));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

const post = {
  id: "post-1",
  type: "TEXT",
  title: null,
  content: "Class update",
  isPinned: false,
  createdAt: "2026-09-10T08:00:00.000Z",
  editedAt: null,
  author: { id: "teacher-1", name: "Teacher", image: null },
  isOwnPost: false,
  _count: { comments: 1, files: 0 },
  files: [],
  assignment: null,
  test: null,
  course: null,
};

const parentComment = {
  id: "comment-1",
  content: "Great question",
  createdAt: "2026-09-10T08:05:00.000Z",
  author: { id: "student-1", name: "Ada", image: null },
  replies: [],
};

describe("ClassroomFeed comment replies", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/posts?") && !init?.method) {
        return new Response(JSON.stringify({ posts: [post], page: 1, total: 1, hasMore: false }));
      }
      if (url.endsWith("/posts/post-1/comments") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "reply-1" }), { status: 201 });
      }
      if (url.endsWith("/posts/post-1/comments")) {
        return new Response(JSON.stringify([parentComment]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));
  });

  it("sends the selected parent comment id when replying", async () => {
    render(<ClassroomFeed classroomId="class-1" isTeacher={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "1 comment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reply to Ada" }));

    const replyInput = screen.getByRole("textbox", { name: "Reply to Ada" });
    expect(replyInput).toHaveFocus();
    fireEvent.change(replyInput, { target: { value: "Thanks for explaining" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/classrooms/class-1/posts/post-1/comments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "Thanks for explaining", parentId: "comment-1" }),
        }),
      );
    });
  });

  it("can cancel a reply and return to a regular comment", async () => {
    render(<ClassroomFeed classroomId="class-1" isTeacher={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "1 comment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reply to Ada" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel reply" }));

    expect(screen.getByRole("textbox", { name: "Write a comment" })).toBeInTheDocument();
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument();
  });

  it("shows the server reason when a classroom file upload is rejected", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/posts?") && !init?.method) {
        return new Response(JSON.stringify({ posts: [], page: 1, total: 0, hasMore: false }));
      }
      if (url === "/api/uploads" && init?.method === "POST") {
        return new Response(JSON.stringify({ error: "Malware scanner unavailable" }), { status: 503 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { container } = render(<ClassroomFeed classroomId="class-1" isTeacher />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: { files: [new File(["lesson notes"], "notes.txt", { type: "text/plain" })] },
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("notes.txt: Malware scanner unavailable");
    });
  });

  it("opens a test preview from the feed for classroom staff", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/posts?")) {
        return new Response(JSON.stringify({
          posts: [{
            ...post,
            id: "post-test",
            type: "TEST",
            content: null,
            test: { id: "test-1", title: "Generated assessment", type: "EXAM", timeLimit: 30 },
          }],
          page: 1,
          total: 1,
          hasMore: false,
        }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<ClassroomFeed classroomId="class-1" isTeacher />);
    expect(await screen.findByRole("link", { name: "Open exam Generated assessment" })).toHaveAttribute("href", "/classroom/class-1/tests/test-1");
    fireEvent.click(await screen.findByRole("button", { name: "Preview exam Generated assessment" }));

    expect(screen.getByText("Assessment preview test-1")).toBeInTheDocument();
  });
});
