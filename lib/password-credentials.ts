import bcrypt from "bcryptjs";

type PasswordUser = {
  password: string | null;
  emailVerified: Date | null;
};

export type PasswordCredentialsStatus = "valid" | "invalid" | "unverified";

export async function passwordCredentialsStatus(user: PasswordUser | null, password: string): Promise<PasswordCredentialsStatus> {
  if (!user?.password) return "invalid";
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) return "invalid";
  return user.emailVerified ? "valid" : "unverified";
}
