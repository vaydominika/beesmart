export type MockSession = {
  user: { id: string; name: string; email: string };
  expires: string;
} | null;

export function buildMockSession(user: Partial<NonNullable<MockSession>["user"]> = {}): NonNullable<MockSession> {
  return {
    user: { id: "user-1", name: "Ada", email: "ada@example.com", ...user },
    expires: "2099-01-01",
  };
}
