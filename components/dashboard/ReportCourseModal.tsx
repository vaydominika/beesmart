"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { Flag } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReportCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
  courseTitle: string;
  onSuccess?: () => void;
}

const REPORT_REASONS = [
  "Inappropriate content",
  "Incorrect or misleading information",
  "Copyright violation",
  "Spam or advertising",
  "Other",
];

export function ReportCourseModal({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  onSuccess,
}: ReportCourseModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!courseId || !reason.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          description: description.trim() || undefined,
        }),
      });
      const result = await res.json();
      setLoading(false);
      if (result.ok) {
        setReason("");
        setDescription("");
        toast.success("Report submitted");
        onOpenChange(false);
        onSuccess?.();
      } else {
        const msg = result.error ?? "Failed to submit report";
        setError(msg);
        toast.error(msg);
      }
    } catch (e) {
      setLoading(false);
      const msg = e instanceof Error ? e.message : "Failed to submit report";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason("");
      setDescription("");
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 max-w-2xl max-h-[85vh] border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
        <FancyCard className="bg-(--theme-bg) p-4 md:p-10 flex flex-col max-h-[85vh] md:max-h-[82vh] overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 md:pb-0">
            <DialogTitle className="flex items-center gap-2 text-xl md:text-[40px] font-bold text-(--theme-text) uppercase">
              <Flag className="h-6 w-6 md:w-12 md:h-12" />
              REPORT: {courseTitle ? courseTitle.toUpperCase() : "COURSE"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="my-2 md:my-6 flex-1 min-h-0">
            <div className="space-y-4 px-2 pb-4">
              <div>
                <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                  REASON (REQUIRED)
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl corner-squircle border-0 bg-(--theme-sidebar) text-base md:text-[22px] font-bold text-(--theme-text) px-4 py-3 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card)"
                >
                  <option value="">Select a reason</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                  ADDITIONAL DETAILS (OPTIONAL)
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[22px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-14 w-full"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 font-medium">{error}</p>
              )}
            </div>
          </ScrollArea>

          <Separator className="shrink-0 my-1 md:my-0" />

          <DialogFooter className="gap-2 md:gap-6 pt-2 md:pt-6 shrink-0 pb-1 md:pb-0">
            <FancyButton
              onClick={() => handleOpenChange(false)}
              className="flex-1 text-(--theme-text) text-xs md:text-[34px] font-bold uppercase"
            >
              CANCEL
            </FancyButton>
            <FancyButton
              onClick={handleSubmit}
              disabled={!reason.trim() || loading}
              className="flex-1 text-(--theme-text) text-xs md:text-[34px] font-bold uppercase"
            >
              {loading ? "SUBMITTING…" : "SUBMIT REPORT"}
            </FancyButton>
          </DialogFooter>
        </FancyCard>
      </DialogContent>
    </Dialog>
  );
}
