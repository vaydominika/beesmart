"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function AuthenticatedApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const hasValidUser = typeof session?.user?.id === "string" && session.user.id.length > 0;

  useEffect(() => {
    if (status === "unauthenticated" || (status === "authenticated" && !hasValidUser)) {
      router.replace("/login");
    }
  }, [hasValidUser, router, status]);

  if (status !== "authenticated" || !hasValidUser) return null;
  return children;
}
