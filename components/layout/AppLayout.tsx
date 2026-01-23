"use client";

import { Header } from "./Header";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { TimerWidget } from "@/components/focus/TimerWidget";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[var(--theme-bg)]">
      <LeftSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[var(--theme-bg)]">{children}</main>
      </div>
      <RightSidebar />
      <TimerWidget />
    </div>
  );
}
