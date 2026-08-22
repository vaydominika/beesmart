import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deletePrivateFile, getUploadStorageRoot, readPrivateFile, writePrivateFile } from "./storage";

let temporaryDirectory: string | null = null;

describe("private upload storage configuration", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = null;
  });

  it("requires persistent storage in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPLOAD_STORAGE_DIR", "");
    expect(() => getUploadStorageRoot()).toThrow("UPLOAD_STORAGE_DIR is required in production");
  });

  it("rejects relative storage paths", () => {
    vi.stubEnv("UPLOAD_STORAGE_DIR", "relative/uploads");
    expect(() => getUploadStorageRoot()).toThrow("UPLOAD_STORAGE_DIR must be absolute");
  });

  it("returns the configured absolute path", () => {
    const configured = path.resolve("private-uploads");
    vi.stubEnv("UPLOAD_STORAGE_DIR", configured);
    expect(getUploadStorageRoot()).toBe(configured);
  });

  it("writes, reads, and removes a protected file inside the configured root", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "beesmart-storage-"));
    vi.stubEnv("UPLOAD_STORAGE_DIR", temporaryDirectory);
    const key = "ab/00000000-0000-0000-0000-000000000000";

    await writePrivateFile(key, Buffer.from("protected"));
    await expect(readPrivateFile(key)).resolves.toEqual(Buffer.from("protected"));
    await deletePrivateFile(key);
    await expect(readPrivateFile(key)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects traversal and malformed storage keys", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "beesmart-storage-"));
    vi.stubEnv("UPLOAD_STORAGE_DIR", temporaryDirectory);
    await expect(readPrivateFile("../secret")).rejects.toThrow("Invalid storage key");
  });
});
