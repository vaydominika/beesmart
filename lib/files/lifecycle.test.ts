import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), updateMany: vi.fn(), removeRecord: vi.fn(), deletePrivateFile: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { storedFile: {
  findMany: mocks.findMany,
  updateMany: mocks.updateMany,
  delete: mocks.removeRecord,
} } }));
vi.mock("./storage", () => ({ deletePrivateFile: mocks.deletePrivateFile }));

import { UploadClaimError, claimUploads, cleanupStoredFiles, markFilesForDeletion, purgeStoredFiles } from "./lifecycle";

describe("stored-file lifecycle", () => {
  beforeEach(() => {
    mocks.deletePrivateFile.mockResolvedValue(undefined);
    mocks.removeRecord.mockResolvedValue({});
  });

  it("rejects duplicate and unavailable upload claims", async () => {
    const tx = { storedFile: { findMany: vi.fn(), updateMany: vi.fn() } } as never;
    await expect(claimUploads(tx, ["same", "same"], "owner", "POST_ATTACHMENT")).rejects.toBeInstanceOf(UploadClaimError);
    vi.mocked((tx as unknown as { storedFile: { findMany: ReturnType<typeof vi.fn> } }).storedFile.findMany).mockResolvedValue([]);
    await expect(claimUploads(tx, ["missing"], "owner", "POST_ATTACHMENT")).rejects.toThrow("unavailable");
  });

  it("atomically claims unique files and preserves requested ordering", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "b" }, { id: "a" }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const tx = { storedFile: { findMany, updateMany } } as never;
    const result = await claimUploads(tx, ["a", "b"], "owner", "POST_ATTACHMENT");
    expect(result.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: "ATTACHED" }) }));
  });

  it("detects a concurrent claim race", async () => {
    const tx = { storedFile: {
      findMany: vi.fn().mockResolvedValue([{ id: "a" }]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    } } as never;
    await expect(claimUploads(tx, ["a"], "owner", "POST_ATTACHMENT")).rejects.toThrow("already claimed");
  });

  it("deduplicates deletion markers", async () => {
    const updateMany = vi.fn();
    await markFilesForDeletion({ storedFile: { updateMany } } as never, ["a", "a", "", "b"]);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ["a", "b"] } }, data: { state: "DELETE_PENDING" } });
  });

  it("purges only delete-pending files and continues after individual failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.findMany.mockResolvedValue([{ id: "a", storageKey: "aa/a" }, { id: "b", storageKey: "bb/b" }]);
    mocks.deletePrivateFile.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("locked"));
    await purgeStoredFiles(["a", "b", "a"]);
    expect(mocks.removeRecord).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("file_cleanup_failed", expect.objectContaining({ storedFileId: "b", error: "locked" }));
  });

  it("marks expired pending files and purges a bounded cleanup batch", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findMany.mockResolvedValue([{ id: "expired", storageKey: "ee/file" }]);
    expect(await cleanupStoredFiles(10)).toBe(1);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(mocks.deletePrivateFile).toHaveBeenCalledWith("ee/file");
  });
});
