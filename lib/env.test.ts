import { describe, expect, it } from "vitest";
import path from "node:path";
import { productionEnvironmentErrors, RESEND_EMAIL_FROM } from "./env";

const validEnvironment = {
  DATABASE_URL: "mysql://user:pass@db:3306/beesmart",
  AUTH_SECRET: "a-long-random-secret-at-least-32-characters",
  AUTH_URL: "https://beesmart.example",
  DEEPSEEK_API_KEY: "deepseek-key",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: RESEND_EMAIL_FROM,
  UPLOAD_STORAGE_DIR: path.resolve("beesmart-uploads"),
  MALWARE_SCAN_MODE: "clamav",
  CLAMAV_HOST: "clamav",
  CLAMAV_PORT: "3310",
};

describe("production environment validation", () => {
  it("accepts a fully configured production environment", () => {
    expect(productionEnvironmentErrors(validEnvironment)).toEqual([]);
  });

  it("rejects unsafe storage and scanner configuration", () => {
    const errors = productionEnvironmentErrors({
      ...validEnvironment,
      UPLOAD_STORAGE_DIR: "relative/uploads",
      MALWARE_SCAN_MODE: "off",
      CLAMAV_PORT: "invalid",
    });
    expect(errors).toContain("UPLOAD_STORAGE_DIR must be absolute");
    expect(errors).toContain("MALWARE_SCAN_MODE must be clamav in production");
    expect(errors).toContain("CLAMAV_PORT must be an integer between 1 and 65535");
  });

  it("requires paired Google credentials", () => {
    expect(productionEnvironmentErrors({ ...validEnvironment, GOOGLE_CLIENT_ID: "client" }))
      .toContain("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together");
  });

  it("rejects a weak authentication secret", () => {
    expect(productionEnvironmentErrors({ ...validEnvironment, AUTH_SECRET: "too-short" }))
      .toContain("AUTH_SECRET must be at least 32 characters");
  });

  it("requires the sender to use the verified Resend domain", () => {
    expect(productionEnvironmentErrors({ ...validEnvironment, EMAIL_FROM: "BeeSmart <noreply@example.com>" }))
      .toContain(`EMAIL_FROM must be ${RESEND_EMAIL_FROM}`);
  });
});
