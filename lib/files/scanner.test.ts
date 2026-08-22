import { afterEach, describe, expect, it, vi } from "vitest";
import { MalwareScanError, scanForMalware } from "./scanner";

describe("malware scanner configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

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
});
