import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export function getUploadStorageRoot() {
  const configured = process.env.UPLOAD_STORAGE_DIR?.trim();
  if (configured) {
    if (!path.isAbsolute(configured)) throw new Error("UPLOAD_STORAGE_DIR must be absolute");
    return path.resolve(configured);
  }
  if (process.env.NODE_ENV === "production") throw new Error("UPLOAD_STORAGE_DIR is required in production");
  return path.resolve(process.cwd(), ".data", "uploads");
}

function resolveStorageKey(storageKey: string) {
  if (!/^[a-f0-9]{2}\/[a-f0-9-]{36}$/.test(storageKey)) throw new Error("Invalid storage key");
  const root = getUploadStorageRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage path");
  return resolved;
}

export async function writePrivateFile(storageKey: string, buffer: Buffer) {
  const destination = resolveStorageKey(storageKey);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(destination), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ destination, buffer, { flag: "wx" });
}

export async function readPrivateFile(storageKey: string) {
  return readFile(/*turbopackIgnore: true*/ resolveStorageKey(storageKey));
}

export async function deletePrivateFile(storageKey: string) {
  try {
    await unlink(/*turbopackIgnore: true*/ resolveStorageKey(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
