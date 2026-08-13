"use client";

import { useState } from "react";
import { MainContent } from "@/components/dashboard/MainContent";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { BasedOnYourCoursesCard } from "@/components/dashboard/BasedOnYourCoursesCard";
import { SurpriseMeCard } from "@/components/dashboard/SurpriseMeCard";
import { Search, X } from "lucide-react";

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="dashboard-ui min-h-full bg-[var(--dashboard-canvas)] px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--dashboard-text)] md:text-[42px]">
              Dashboard
            </h1>
          </div>
          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Search dashboard courses</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dashboard-text-faint)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search courses"
              className="h-10 w-full rounded-xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] pl-9 pr-10 text-sm text-[var(--dashboard-text)] outline-none placeholder:text-[var(--dashboard-text-faint)] focus:border-[var(--dashboard-focus-border)] focus:ring-2 focus:ring-[var(--dashboard-focus-ring)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear course search"
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-surface-muted)] hover:text-[var(--dashboard-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dashboard-focus-ring)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </header>

        <div className="space-y-4">
          <WelcomeBanner />
          <div className="grid gap-4 md:grid-cols-2">
            <BasedOnYourCoursesCard />
            <SurpriseMeCard />
          </div>
        </div>

        <MainContent searchQuery={searchQuery} onClearSearch={() => setSearchQuery("")} />
      </div>
    </div>
  );
}
