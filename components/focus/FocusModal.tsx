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
import { Button } from "@/components/ui/button";
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
      <DialogContent className="bg-[#FFF6C4] rounded-[30px] p-8 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-[32px] font-bold text-[var(--theme-text)] uppercase">
            <HugeiconsIcon icon={Idea01Icon} />
            FOCUS
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          <div>
            <p className="text-[24px] font-bold text-[var(--theme-text)] mb-4">
              TIME TO{" "}
              <span className="text-[#B25121]">BEE</span> PRODUCTIVE!
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[20px] font-bold text-[var(--theme-text)] uppercase mb-2">
                ACTIVE MINUTES
              </label>
              <Input
                type="number"
                value={localActiveMinutes}
                onChange={(e) => setLocalActiveMinutes(e.target.value)}
                className="bg-[#FADA6D] rounded-[20px] px-4 py-3 text-[24px] font-bold text-center border-0 focus-visible:ring-2 focus-visible:ring-[var(--theme-text)]"
                min="1"
                max="120"
              />
            </div>

            <div>
              <label className="block text-[20px] font-bold text-[var(--theme-text)] uppercase mb-2">
                BREAK
              </label>
              <Input
                type="number"
                value={localBreakMinutes}
                onChange={(e) => setLocalBreakMinutes(e.target.value)}
                className="bg-[#FADA6D] rounded-[20px] px-4 py-3 text-[24px] font-bold text-center border-0 focus-visible:ring-2 focus-visible:ring-[var(--theme-text)]"
                min="1"
                max="60"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="text-[18px] font-bold text-[var(--theme-text)] uppercase">
                Auto switch to break
              </label>
              <Switch
                checked={autoBreak}
                onCheckedChange={setAutoBreak}
                className="data-[state=checked]:bg-[#FADA6D]"
              />
            </div>
          </div>

          <Button
            onClick={handleStart}
            className="w-full bg-[#FADA6D] hover:bg-[#FADA6D]/90 text-[var(--theme-text)] text-[24px] font-bold uppercase rounded-[20px] py-4 border-0"
          >
            BEE-GIN
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
