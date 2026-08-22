import path from "node:path";

type Environment = Record<string, string | undefined>;

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export function productionEnvironmentErrors(env: Environment) {
  const errors: string[] = [];
  if (!present(env.DATABASE_URL)) errors.push("DATABASE_URL is required");
  const authSecret = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim();
  if (!authSecret) errors.push("AUTH_SECRET is required");
  else if (authSecret.length < 32) errors.push("AUTH_SECRET must be at least 32 characters");
  if (!present(env.AUTH_URL) && !present(env.NEXTAUTH_URL)) errors.push("AUTH_URL is required");
  if (!present(env.DEEPSEEK_API_KEY)) errors.push("DEEPSEEK_API_KEY is required");

  const storage = env.UPLOAD_STORAGE_DIR?.trim();
  if (!storage) errors.push("UPLOAD_STORAGE_DIR is required");
  else if (!path.isAbsolute(storage)) errors.push("UPLOAD_STORAGE_DIR must be absolute");

  if (env.MALWARE_SCAN_MODE?.trim().toLowerCase() !== "clamav") {
    errors.push("MALWARE_SCAN_MODE must be clamav in production");
  }
  if (!present(env.CLAMAV_HOST)) errors.push("CLAMAV_HOST is required");
  const clamavPort = Number(env.CLAMAV_PORT);
  if (!Number.isInteger(clamavPort) || clamavPort < 1 || clamavPort > 65_535) {
    errors.push("CLAMAV_PORT must be an integer between 1 and 65535");
  }

  const googleClient = present(env.GOOGLE_CLIENT_ID);
  const googleSecret = present(env.GOOGLE_CLIENT_SECRET);
  if (googleClient !== googleSecret) errors.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together");

  return errors;
}

export function assertProductionEnvironment(env: Environment = process.env) {
  const errors = productionEnvironmentErrors(env);
  if (errors.length) {
    throw new Error(`Invalid production environment:\n- ${errors.join("\n- ")}`);
  }
}
