import net from "node:net";
import type { FileScanStatus } from "@/lib/generated/prisma";

export class MalwareScanError extends Error {
  constructor(message: string, public infected = false) { super(message); }
}

export async function scanForMalware(buffer: Buffer): Promise<FileScanStatus> {
  const fallbackMode = process.env.NODE_ENV === "production" ? "clamav" : "off";
  const mode = (process.env.MALWARE_SCAN_MODE ?? fallbackMode).toLowerCase();
  if (mode === "off") {
    if (process.env.NODE_ENV === "production") {
      throw new MalwareScanError("Malware scanning cannot be disabled in production");
    }
    return "NOT_REQUIRED";
  }
  if (mode !== "clamav") throw new MalwareScanError("Unsupported malware scanner configuration");

  const host = process.env.CLAMAV_HOST || "127.0.0.1";
  const port = Number(process.env.CLAMAV_PORT || 3310);
  const timeout = Number(process.env.CLAMAV_TIMEOUT_MS || 10_000);

  const response = await new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    const fail = (error: Error) => { socket.destroy(); reject(error); };
    socket.setTimeout(timeout, () => fail(new Error("ClamAV scan timed out")));
    socket.on("error", fail);
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
        const size = Buffer.alloc(4); size.writeUInt32BE(chunk.length); socket.write(size); socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  }).catch((error) => { throw new MalwareScanError(error instanceof Error ? error.message : "Malware scanner unavailable"); });

  if (response.includes(" FOUND")) throw new MalwareScanError("Malware detected", true);
  if (!response.includes(" OK")) throw new MalwareScanError("Malware scanner returned an invalid response");
  return "CLEAN";
}
