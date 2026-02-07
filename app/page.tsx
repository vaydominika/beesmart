"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MainContent } from "@/components/dashboard/MainContent";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { BasedOnYourCoursesCard } from "@/components/dashboard/BasedOnYourCoursesCard";
import { SurpriseMeCard } from "@/components/dashboard/SurpriseMeCard";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
  return (
    <ScrollArea className="h-full overflow-y-auto">
    <div className="flex flex-col">
      <div className="px-6 pt-4 pb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-(--theme-text)" />
          <Input
            type="search"
            placeholder="SEARCH"
            className="pl-10 bg-white border-gray-200 text-(--theme-text) w-full"
          />
        </div>
        <WelcomeBanner />
        <div className="flex gap-4">
          <BasedOnYourCoursesCard />
          <SurpriseMeCard />
        </div>
      </div>
      <MainContent />
    </div>
    </ScrollArea>
  );
}
