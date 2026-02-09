"use client";

import Image from "next/image";
import { FancyButton } from "@/components/ui/fancybutton";
import { FancyCard } from "@/components/ui/fancycard";
import { useSettings } from "@/components/settings/SettingsProvider";

export function WelcomeBanner() {
  const { userName } = useSettings();
  
  return (
    <FancyCard>
      <div className="p-4 md:p-6 flex flex-col md:flex-row items-center md:items-stretch md:justify-between gap-4">
        <div className="flex-1 flex flex-col text-center md:text-left">
          <h2 className="text-2xl sm:text-3xl md:text-[48px] font-bold tracking-tight text-(--theme-text)">
            WELCOME BACK, <span className="text-(--theme-secondary)">{userName.toUpperCase()}!</span>
          </h2>
          <p className="text-lg sm:text-xl md:text-[40px] text-(--theme-text) mb-4 tracking-tight">
            THINGS JUST WEREN'T THE SAME WITHOUT YOUR BEE-AUTIFUL PRESENCE!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center md:justify-start">
            <FancyButton
              className="text-lg sm:text-xl md:text-[32px] text-(--theme-text-important) bg-(--theme-sidebar) uppercase font-semibold"
              onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
            >
              LET'S DISCOVER!
            </FancyButton>
            <FancyButton
              className="text-lg sm:text-xl md:text-[32px] gap-4 text-(--theme-text-important) bg-(--theme-sidebar) uppercase font-semibold"
              onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
            >
              MAKE YOUR OWN!
            </FancyButton>
          </div>
        </div>
        <div className="md:ml-8 shrink-0">
          <Image
            src="/images/WelcomeBackBee.png"
            alt="Welcome Bee"
            width={200}
            height={200}
            className="h-auto w-24 sm:w-32 md:w-[200px]"
          />
        </div>
      </div>
    </FancyCard>
  );
}
