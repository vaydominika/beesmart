"use client";

import { useText } from "@/i18n/use-text";
import { Spinner } from "@/components/ui/spinner";

export function AppRouteLoading() {
  const t = useText();
  return (
    <div
      className="sticky top-0 z-10 flex h-[calc(100dvh-4rem)] min-h-72 w-full items-center justify-center bg-[var(--app-canvas)] md:h-screen"
    >
      <Spinner className="h-8 w-8 text-[var(--app-text)]" aria-label={t("Loading page")} />
    </div>
  );
}
