"use client";

import { useState } from "react";
import { MainContent } from "@/components/dashboard/MainContent";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { BasedOnYourCoursesCard } from "@/components/dashboard/BasedOnYourCoursesCard";
import { SurpriseMeCard } from "@/components/dashboard/SurpriseMeCard";
import { WorkspaceSearchField } from "@/components/ui/workspace-search-field";
import { WorkspacePageFrame, WorkspacePageHeader } from "@/components/ui/workspace-page";

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <WorkspacePageFrame className="dashboard-ui bg-[var(--dashboard-canvas)]">
        <WorkspacePageHeader title="Dashboard" titleClassName="text-[var(--dashboard-text)]" actions={<WorkspaceSearchField type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onClear={() => setSearchQuery("")} placeholder="Search courses" aria-label="Search dashboard courses" wrapperClassName="w-full sm:w-80" className="h-10 border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] text-[var(--dashboard-text)] placeholder:text-[var(--dashboard-text-faint)] focus:border-[var(--dashboard-focus-border)] focus:ring-[var(--dashboard-focus-ring)]" />} />

        <div className="space-y-4">
          <WelcomeBanner />
          <div className="grid gap-4 md:grid-cols-2">
            <BasedOnYourCoursesCard />
            <SurpriseMeCard />
          </div>
        </div>

        <MainContent searchQuery={searchQuery} onClearSearch={() => setSearchQuery("")} />
    </WorkspacePageFrame>
  );
}
