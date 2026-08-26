import { describe, expect, it } from "vitest";
import { readJsonSafely } from "./http";

describe("readJsonSafely", () => {
  it("returns parsed JSON and uses its fallback for invalid bodies", async () => {
    await expect(readJsonSafely(new Response(JSON.stringify({ ok: true })), { ok: false })).resolves.toEqual({ ok: true });
    await expect(readJsonSafely(new Response("not-json"), { ok: false })).resolves.toEqual({ ok: false });
  });
});
