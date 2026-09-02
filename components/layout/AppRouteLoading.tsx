import { Spinner } from "@/components/ui/spinner";

export function AppRouteLoading() {
  return (
    <div
      className="flex h-[calc(100dvh-65px)] min-h-72 w-full items-center justify-center bg-[var(--app-canvas)] md:h-screen"
    >
      <Spinner className="h-8 w-8 text-[var(--app-text)]" aria-label="Loading page" />
    </div>
  );
}
