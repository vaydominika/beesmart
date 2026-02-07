"use client";

import { FancyButton } from "@/components/ui/fancybutton";
import { FancyCard } from "@/components/ui/fancycard";

export function SurpriseMeCard() {
  return (
    <FancyCard className="flex-1 min-w-0 relative overflow-hidden bg-(--theme-sidebar)">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-8 pointer-events-none"
        style={{ backgroundImage: "url('/svg/CardBackground.svg')" }}
      />
      <div className="relative z-10 p-6 flex flex-col">
        <h2 className="text-2xl font-bold tracking-tight text-(--theme-text)">
            TRY SOMETHING NEW
        </h2>
        <p className="text-lg text-(--theme-text) mb-4 tracking-tight">
            Let the hive choose a course for you!
        </p>
        <FancyButton
          className="text-lg text-(--theme-text) bg-(--theme-card) uppercase font-semibold w-fit"
          onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
        >
          Surprise me
        </FancyButton>
      </div>
    </FancyCard>
  );
}
