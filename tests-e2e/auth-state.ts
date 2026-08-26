import path from "node:path";
import { TEST_IDENTITIES } from "@/test-utils/factories";

export const AUTH_STATE_DIR = path.join(process.cwd(), "test-results", ".auth");

export function authStatePath(role: keyof typeof TEST_IDENTITIES) {
  return path.join(AUTH_STATE_DIR, `${role}.json`);
}
