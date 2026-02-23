"use client";

import { Input } from "@/components/ui/input";
import { MainContent } from "@/components/dashboard/MainContent";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { BasedOnYourCoursesCard } from "@/components/dashboard/BasedOnYourCoursesCard";
import { SurpriseMeCard } from "@/components/dashboard/SurpriseMeCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

export default function DashboardPage() {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">
        <div className="px-6 pt-4 pb-6 space-y-4">
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2.5} className="absolute left-3 top-1.5 h-5 w-5 text-(--theme-text)" />
            <Input
              type="search"
              placeholder="SEARCH"
              className="pl-9 bg-white border-(--theme-card) text-(--theme-text) w-full rounded-xl corner-squircle"
            />
          </div>
          <WelcomeBanner />
          <div className="flex flex-col md:flex-row gap-4">
            <BasedOnYourCoursesCard />
            <SurpriseMeCard />
          </div>
        </div>
        <MainContent />
      </div>
    </ScrollArea>
  );
}
