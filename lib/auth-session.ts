import type { JWT } from "@auth/core/jwt";

type UserExists = (userId: string) => Promise<boolean>;

export async function validateSessionToken(
  token: JWT,
  signedInUserId: string | null,
  userExists: UserExists,
): Promise<JWT> {
  const candidate = signedInUserId
    ?? (typeof token.id === "string" ? token.id : null)
    ?? (typeof token.sub === "string" ? token.sub : null);

  if (!candidate || !(await userExists(candidate))) {
    return { ...token, id: undefined, sub: undefined, sessionInvalid: true };
  }

  return { ...token, id: candidate, sessionInvalid: false };
}

export function validSessionUserId(token: JWT) {
  if (token.sessionInvalid === true) return null;
  const candidate = token.id ?? token.sub;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}
