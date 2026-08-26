import { afterEach, describe, expect, it, vi } from "vitest";
import net from "node:net";
import { EventEmitter } from "node:events";
import { MalwareScanError, scanForMalware } from "./scanner";

describe("malware scanner configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows an explicit development opt-out", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("MALWARE_SCAN_MODE", "off");
    await expect(scanForMalware(Buffer.from("safe"))).resolves.toBe("NOT_REQUIRED");
  });

  it("rejects unsupported scanner modes", async () => {
    vi.stubEnv("MALWARE_SCAN_MODE", "unknown");
    await expect(scanForMalware(Buffer.from("safe"))).rejects.toBeInstanceOf(MalwareScanError);
  });

  it("cannot be disabled in production even if startup validation is bypassed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MALWARE_SCAN_MODE", "off");
    await expect(scanForMalware(Buffer.from("safe"))).rejects.toThrow(
      "Malware scanning cannot be disabled in production",
    );
  });

  it("streams data to ClamAV and accepts a clean response", async () => {
    vi.stubEnv("MALWARE_SCAN_MODE", "clamav");
    const socket = fakeClamSocket("stream: OK\0");
    vi.spyOn(net, "createConnection").mockReturnValue(socket as never);
    await expect(scanForMalware(Buffer.alloc(70_000, 1))).resolves.toBe("CLEAN");
    expect(socket.writes).toHaveLength(5);
    expect(socket.writes[0]).toBe("zINSTREAM\0");
  });

  it("distinguishes infected and malformed scanner responses", async () => {
    vi.stubEnv("MALWARE_SCAN_MODE", "clamav");
    vi.spyOn(net, "createConnection").mockReturnValueOnce(fakeClamSocket("stream: Eicar-Test-Signature FOUND\0") as never);
    const infected = await scanForMalware(Buffer.from("virus")).catch((error) => error);
    expect(infected).toBeInstanceOf(MalwareScanError);
    expect(infected.infected).toBe(true);

    vi.mocked(net.createConnection).mockReturnValueOnce(fakeClamSocket("unexpected") as never);
    await expect(scanForMalware(Buffer.from("unknown"))).rejects.toThrow("invalid response");
  });

  it("wraps scanner connection failures without exposing implementation errors", async () => {
    vi.stubEnv("MALWARE_SCAN_MODE", "clamav");
    const socket = fakeClamSocket(null, new Error("connection refused"));
    vi.spyOn(net, "createConnection").mockReturnValue(socket as never);
    await expect(scanForMalware(Buffer.from("safe"))).rejects.toEqual(expect.objectContaining({
      message: "connection refused", infected: false,
    }));
    expect(socket.destroy).toHaveBeenCalled();
  });
});

function fakeClamSocket(response: string | null, failure?: Error) {
  const emitter = new EventEmitter();
  const writes: Array<string | Buffer> = [];
  const socket = Object.assign(emitter, {
    writes,
    destroy: vi.fn(),
    setTimeout: vi.fn(),
    write: vi.fn((value: string | Buffer) => { writes.push(value); return true; }),
    end: vi.fn(() => {
      queueMicrotask(() => {
        if (failure) emitter.emit("error", failure);
        else {
          if (response !== null) emitter.emit("data", Buffer.from(response));
          emitter.emit("end");
        }
      });
    }),
  });
  queueMicrotask(() => emitter.emit("connect"));
  return socket;
}
