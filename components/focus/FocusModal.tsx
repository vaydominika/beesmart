"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FancyButton } from "@/components/ui/fancybutton";
import { FancyCard } from "@/components/ui/fancycard";
import { Separator } from "@/components/ui/separator";
import { useFocus } from "./FocusProvider";
import { HugeiconsIcon } from "@hugeicons/react";
import { Idea01Icon } from "@hugeicons/core-free-icons";

export function FocusModal() {
  const {
    isModalOpen,
    closeModal,
    activeMinutes,
    breakMinutes,
    autoBreak,
    setActiveMinutes,
    setBreakMinutes,
    setAutoBreak,
    startSession,
    stats,
    isStatsLoading,
    statsError,
  } = useFocus();

  const handleStart = () => {
    const active = Math.min(120, Math.max(1, activeMinutes || 45));
    const breakMins = Math.min(60, Math.max(1, breakMinutes || 15));
    
    setActiveMinutes(active);
    setBreakMinutes(breakMins);
    startSession({ activeMinutes: active, breakMinutes: breakMins, autoBreak });
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={closeModal}>
      <DialogContent className="p-0 max-w-xs border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
        <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 md:pb-0">
            <DialogTitle className="flex items-center gap-2 text-xl md:text-[40px] font-bold text-(--theme-text) uppercase">
              <HugeiconsIcon icon={Idea01Icon} size={24} className="md:w-12 md:h-12" strokeWidth={2.2} />
              FOCUS
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-2 md:my-4">
            <p className="text-base md:text-[24px] font-bold text-(--theme-text)">
              TIME TO{" "}
              <span className="text-(--theme-secondary)">BEE</span> PRODUCTIVE!
            </p>

            <div aria-label="All-time focus statistics" className="grid grid-cols-2 gap-2">
              <div className="rounded-xl corner-squircle bg-(--theme-sidebar) px-3 py-2.5">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wide text-(--theme-text)/65">Focus sessions</p>
                <p className="mt-1 text-2xl md:text-3xl font-bold text-(--theme-text)">{isStatsLoading ? "–" : stats.focusCount}</p>
              </div>
              <div className="rounded-xl corner-squircle bg-(--theme-card) px-3 py-2.5">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wide text-(--theme-text)/65">Breaks</p>
                <p className="mt-1 text-2xl md:text-3xl font-bold text-(--theme-text)">{isStatsLoading ? "–" : stats.breakCount}</p>
              </div>
            </div>
            {statsError && <p role="status" className="text-xs font-semibold text-red-700">{statsError}</p>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-2">
                  ACTIVE MINUTES
                </label>
                <Input
                  type="number"
                  value={activeMinutes || ""}
                  onChange={(e) => setActiveMinutes(Number(e.target.value))}
                  className="bg-(--theme-sidebar) rounded-xl corner-squircle text-xl md:text-[36px] font-bold text-center border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) w-20 md:w-24 h-12 md:h-14"
                  min="1"
                  max="120"
                />
              </div>

              <div>
                <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-2">
                  BREAK
                </label>
                <Input
                  type="number"
                  value={breakMinutes || ""}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  className="bg-(--theme-sidebar) rounded-xl corner-squircle text-xl md:text-[36px] font-bold text-center border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) w-20 md:w-24 h-12 md:h-14"
                  min="1"
                  max="60"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-sm md:text-[22px] font-bold text-(--theme-text) uppercase">
                  AUTO SWITCH TO BREAK
                </label>
                <Switch
                  checked={autoBreak}
                  onCheckedChange={setAutoBreak}
                  className="data-[state=checked]:bg-(--theme-sidebar) scale-110 md:scale-125"
                />
              </div>
            </div>

            <Separator className="shrink-0 my-2" />

            <FancyButton
              onClick={handleStart}
              className="w-full text-(--theme-text) text-xs md:text-[34px] font-bold uppercase"
            >
              BEE-GIN
            </FancyButton>
          </div>
        </FancyCard>
      </DialogContent>
    </Dialog>
  );
}
