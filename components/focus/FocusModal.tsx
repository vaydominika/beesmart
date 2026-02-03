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
      <DialogContent className="p-0 max-w-xs border-0 bg-transparent shadow-none">
        <FancyCard className="bg-(--theme-bg) p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1 text-[32px] font-bold text-(--theme-text) uppercase">
              <HugeiconsIcon icon={Idea01Icon} size={40} strokeWidth={2.2}/>
              FOCUS
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="text-[24px] font-bold text-(--theme-text) mb-4">
                TIME TO{" "}
                <span className="text-(--theme-secondary)">BEE</span> PRODUCTIVE!
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[20px] font-bold text-(--theme-text) uppercase mb-2">
                  ACTIVE MINUTES
                </label>
                <Input
                  type="number"
                  value={localActiveMinutes}
                  onChange={(e) => setLocalActiveMinutes(e.target.value)}
                  className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[36px]! font-bold text-center border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) w-20 h-12"
                  min="1"
                  max="120"
                />
              </div>

              <div>
                <label className="block text-[20px] font-bold text-(--theme-text) uppercase mb-2">
                  BREAK
                </label>
                <Input
                  type="number"
                  value={localBreakMinutes}
                  onChange={(e) => setLocalBreakMinutes(e.target.value)}
                  className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[36px]! font-bold text-center border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) w-20 h-12"
                  min="1"
                  max="60"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-[18px] font-bold text-(--theme-text) uppercase">
                  Auto switch to break
                </label>
                <Switch
                  checked={autoBreak}
                  onCheckedChange={setAutoBreak}
                  className="data-[state=checked]:bg-(--theme-sidebar)"
                />
              </div>
            </div>

            <FancyButton
              onClick={handleStart}
              className="w-full text-(--theme-text) text-[24px] font-bold uppercase"
            >
              BEE-GIN
            </FancyButton>
          </div>
        </FancyCard>
      </DialogContent>
    </Dialog>
  );
}
