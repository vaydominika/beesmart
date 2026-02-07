"use client";

import Image from "next/image";
import { FancyButton } from "@/components/ui/fancybutton";
import { FancyCard } from "@/components/ui/fancycard";
import { useSettings } from "@/components/settings/SettingsProvider";

export function WelcomeBanner() {
  const { userName } = useSettings();
  
  return (
    <FancyCard>
      <div className="p-6 flex items-center justify-between">
        <div className="flex-1 flex flex-col">
          <h2 className="text-[48px] font-bold tracking-tight text-(--theme-text)">
            WELCOME BACK, <span className="text-(--theme-secondary)">{userName.toUpperCase()}!</span>
          </h2>
          <p className="text-[40px] text-(--theme-text) mb-4 tracking-tight">
            THINGS JUST WEREN'T THE SAME WITHOUT YOUR BEE-AUTIFUL PRESENCE!
          </p>
          <div className="flex gap-4">
          <FancyButton
            className="text-[40px] text-(--theme-text-important) bg-(--theme-sidebar) uppercase font-semibold"
            onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
          >
            LET'S DISCOVER!
          </FancyButton>
          <FancyButton
            className="text-[40px] gap-4 text-(--theme-text-important) bg-(--theme-sidebar) uppercase font-semibold"
            onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
          >
            MAKE YOUR OWN!
          </FancyButton>
          </div>
        </div>
        <div className="ml-8">
          <Image
            src="/images/WelcomeBackBee.png"
            alt="Welcome Bee"
            width={200}
            height={200}
            className="h-auto"
          />
        </div>
      </div>
    </FancyCard>
  );
}
