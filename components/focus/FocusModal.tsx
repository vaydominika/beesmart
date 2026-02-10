"use client";

import { useState } from "react";
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
  } = useFocus();

  const [localActiveMinutes, setLocalActiveMinutes] = useState(activeMinutes.toString());
  const [localBreakMinutes, setLocalBreakMinutes] = useState(breakMinutes.toString());

  const handleStart = () => {
    const active = parseInt(localActiveMinutes) || 45;
    const breakMins = parseInt(localBreakMinutes) || 15;
    
    setActiveMinutes(active);
    setBreakMinutes(breakMins);
    startSession();
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-2">
                  ACTIVE MINUTES
                </label>
                <Input
                  type="number"
                  value={localActiveMinutes}
                  onChange={(e) => setLocalActiveMinutes(e.target.value)}
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
                  value={localBreakMinutes}
                  onChange={(e) => setLocalBreakMinutes(e.target.value)}
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
