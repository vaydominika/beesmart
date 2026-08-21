import { describe, expect, it } from "vitest";
import { configuredAdminEmails, isAdminEmail } from "./admin";

describe("admin email access", () => {
  it("normalizes comma-separated addresses", () => {
    expect([...configuredAdminEmails(" ADA@example.com,admin@example.com ,, ")]).toEqual([
      "ada@example.com",
      "admin@example.com",
    ]);
    expect(isAdminEmail("Ada@Example.com", " ada@example.com ")).toBe(true);
  });

  it("grants nobody access when configuration is empty", () => {
    expect(isAdminEmail("admin@example.com", "")).toBe(false);
    expect(isAdminEmail(null, "admin@example.com")).toBe(false);
  });
});
