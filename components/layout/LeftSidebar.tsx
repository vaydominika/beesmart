"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Lightbulb, LogOut, MessageSquareText, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/DashboardContext";
import { useFocus } from "@/components/focus/FocusProvider";
import { FocusModal } from "@/components/focus/FocusModal";
import { useSettings } from "@/components/settings/SettingsProvider";
import { BeeSmartLogo } from "@/components/ui/BeeSmartLogo";
import { FeedbackModal } from "@/components/tickets/FeedbackModal";

const navigationItems = [
  { name: "DASHBOARD", href: "/dashboard" },
  { name: "SCHEDULE", href: "/schedule" },
  { name: "CLASSROOM", href: "/classroom" },
  { name: "COURSES", href: "/courses" },
];

interface LeftSidebarProps {
  variant?: "inline" | "overlay";
  onClose?: () => void;
}

const feedbackEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.NEXT_PUBLIC_EARLY_ACCESS_FEEDBACK_ENABLED ?? "").trim().toLowerCase(),
);

export function LeftSidebar({ variant = "inline", onClose }: LeftSidebarProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const pathname = usePathname();
  const { openModal } = useFocus();
  const { openModal: openSettingsModal } = useSettings();
  const { data, loading, refetch } = useDashboard();
  const streak = data?.streak ?? 0;
  const isOverlay = variant === "overlay";

  return (
    <div
      className={cn(
        "bg-(--theme-sidebar) flex flex-col rounded-tr-[30px] overflow-visible relative z-10 w-full",
        isOverlay ? "h-screen max-w-[85vw] overflow-hidden" : "h-full w-72"
      )}
      id="sidebar-container"
    >
      <div className="p-6 md:p-4">
        {isOverlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="absolute top-4 right-4 p-2 rounded-md hover:bg-(--theme-sidebar)/80 text-(--theme-text)"
          >
            <X className="h-6 w-6" />
          </button>
        )}
        <div className="flex justify-center mb-6 md:mb-4 -translate-x-1/18">
          <BeeSmartLogo className="h-auto w-60 md:w-40" />
        </div>

        <div className="mx-auto mb-4 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 md:w-[168px] md:p-2">
          <p className="text-center text-[32px] font-semibold uppercase leading-none text-[var(--app-text)] md:text-[26px]">Bee consistent</p>
          <div className="mt-2 flex items-center justify-center gap-2 text-[var(--app-text)]">
            <span className="flex min-h-14 min-w-14 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] px-3 text-[64px] font-bold leading-none md:text-[48px]">
              {loading && !data ? "—" : streak}
            </span>
            <span className="text-[56px] font-bold uppercase leading-none text-[var(--app-text)] md:text-[45px]">{streak === 1 ? "day" : "days"}</span>
          </div>
        </div>
      </div>

      <nav className="m-auto w-full flex-1 overflow-visible pl-0 tracking-tight md:pl-15">
        <ul className="overflow-visible relative space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="relative h-14 overflow-visible md:h-11">
                {isActive && !isOverlay && (
                  <span
                    aria-hidden="true"
                    data-sidebar-active-indicator
                    className="pointer-events-none absolute left-0 top-1/2 z-0 aspect-[348/145] w-full -translate-y-1/2 bg-[var(--app-canvas)]"
                    style={{
                      WebkitMaskImage: "url('/svg/ActiveSidebarElement.svg')",
                      maskImage: "url('/svg/ActiveSidebarElement.svg')",
                      WebkitMaskPosition: "left center",
                      maskPosition: "left center",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskSize: "100% 100%",
                      maskSize: "100% 100%",
                    }}
                  />
                )}
                <div className="relative h-full overflow-visible">
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={isOverlay ? onClose : undefined}
                    className={cn(
                      "relative z-10 mx-6 flex h-full w-[calc(100%-3rem)] items-center justify-center px-0 text-center text-[40px] font-bold uppercase leading-none transition-colors md:mx-0 md:w-full md:justify-start md:px-4 md:text-left md:text-[36px]",
                      isActive && isOverlay && "rounded-xl bg-[var(--app-canvas)]",
                      isActive
                        ? "text-(--theme-text-important)"
                        : "text-(--theme-text) hover:text-(--theme-text-important)"
                    )}
                  >
                    {item.name}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div data-sidebar-utility-actions className="m-auto space-y-1 py-4 text-[26px] font-medium leading-none tracking-tight md:py-3 md:text-[24px]">
        {feedbackEnabled ? (
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="flex min-h-8 w-full cursor-pointer items-center gap-2 uppercase text-(--theme-text) transition-colors hover:text-(--theme-text-important)"
          >
            <MessageSquareText className="h-6 w-6 md:h-5 md:w-5" />
            FEEDBACK
          </button>
        ) : null}
        <button
          onClick={openModal}
          className="flex min-h-8 w-full cursor-pointer items-center gap-2 uppercase text-(--theme-text) transition-colors hover:text-(--theme-text-important)"
        >
          <Lightbulb className="h-6 w-6 md:h-5 md:w-5" />
          FOCUS
        </button>
        <button
          onClick={openSettingsModal}
          className="flex min-h-8 w-full cursor-pointer items-center gap-2 uppercase text-(--theme-text) transition-colors hover:text-(--theme-text-important)"
        >
          <Settings className="h-6 w-6 md:h-5 md:w-5" />
          SETTINGS
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex min-h-8 w-full cursor-pointer items-center gap-2 uppercase text-(--theme-text) transition-colors hover:text-(--theme-text-important)"
        >
          <LogOut className="h-6 w-6 md:h-5 md:w-5" />
          LOG OUT
        </button>
      </div>

      <FocusModal />
      {feedbackEnabled ? <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} onSuccess={() => void refetch()} /> : null}
    </div>
  );
}
