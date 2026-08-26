import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast: mocks }));

import { FeedbackModal } from "./FeedbackModal";

describe("FeedbackModal", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("submits trimmed feedback and closes after success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: "ticket-1" }), { status: 201 }));
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    render(<FeedbackModal open onOpenChange={onOpenChange} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "  The timer jumped.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/tickets", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ description: "The timer jumped.", uploadIds: [] }),
    }));
    expect(mocks.success).toHaveBeenCalledWith("Feedback sent");
  });

  it("keeps the dialog open and displays the server error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Please try again later" }), { status: 429 }));
    const onOpenChange = vi.fn();
    render(<FeedbackModal open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "A useful report" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(await screen.findByText("Please try again later")).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mocks.error).toHaveBeenCalledWith("Please try again later");
  });

  it("rejects non-image attachments before uploading", async () => {
    render(<FeedbackModal open onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText("Add images");
    fireEvent.change(input, { target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("notes.txt is not an image."));
    expect(fetch).not.toHaveBeenCalled();
  });
});
