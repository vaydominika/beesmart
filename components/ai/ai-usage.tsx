"use client";

import { useLocale } from "next-intl";
import { useText } from "@/i18n/use-text";

import { useCallback, useEffect, useState } from "react";
import {
  aiDailyLimitFor,
  AI_USAGE_HEADER_CATEGORY,
  AI_USAGE_HEADER_LIMIT,
  AI_USAGE_HEADER_REMAINING,
  AI_USAGE_HEADER_RESET,
  type AiUsageCategory,
  type AiUsageResponse,
  type AiUsageState,
} from "@/lib/ai/usage-shared";
import { cn } from "@/lib/utils";

export function useAiUsage(category: AiUsageCategory, enabled = true) {
  const [usage, setUsage] = useState<AiUsageState | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/ai/usage");
      if (!response.ok) return;
      const data = await response.json() as AiUsageResponse;
      setUsage(data.categories[category]);
    } catch {
      // The generation endpoint remains the source of truth if status loading fails.
    }
  }, [category, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetch("/api/ai/usage")
      .then(async (response) => response.ok ? response.json() as Promise<AiUsageResponse> : null)
      .then((data) => { if (active && data) setUsage(data.categories[category]); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [category, enabled]);

  useEffect(() => {
    if (!enabled || !usage?.resetsAt) return;
    const delay = Math.max(0, new Date(usage.resetsAt).getTime() - Date.now() + 1000);
    const timeout = window.setTimeout(() => void refresh(), Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [enabled, refresh, usage?.resetsAt]);

  const syncFromResponse = useCallback((response: Response) => {
    const responseCategory = response.headers.get(AI_USAGE_HEADER_CATEGORY);
    const remainingValue = response.headers.get(AI_USAGE_HEADER_REMAINING);
    const limitValue = response.headers.get(AI_USAGE_HEADER_LIMIT);
    const resetsAt = response.headers.get(AI_USAGE_HEADER_RESET);
    if (responseCategory !== category || remainingValue === null || limitValue === null || !resetsAt) return;
    const remaining = Number(remainingValue);
    const limit = Number(limitValue);
    if (!Number.isFinite(remaining) || !Number.isFinite(limit)) return;
    setUsage({ category, remaining, limit, used: limit - remaining, resetsAt });
  }, [category]);

  return {
    usage,
    exhausted: usage?.remaining === 0,
    refresh,
    syncFromResponse,
  };
}

function localResetTime(resetsAt: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(resetsAt));
}

export function AiUsageStatus({ usage, category = "LESSON_CONTENT", unit = "AI attempt", className }: { usage: AiUsageState | null; category?: AiUsageCategory; unit?: string; className?: string }) {
  const locale = useLocale();
  const t = useText();
  const remaining = usage?.remaining ?? aiDailyLimitFor(category);
  return (
    <p role="status" className={cn("flex w-fit max-w-full flex-wrap items-center gap-x-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[10px] font-medium text-[var(--app-text-muted)]", className)}>
      <span>{remaining} {t(unit)}{remaining === 1 ? "" : t("s")}  {t("left today")}</span>
      {usage?.resetsAt && <span aria-label={t("Resets at {v0}", { v0: localResetTime(usage.resetsAt, locale) })}>{t("· Resets")} {localResetTime(usage.resetsAt, locale)}</span>}
    </p>
  );
}
