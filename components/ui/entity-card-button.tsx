"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function EntityCardButton({ className, ...props }: React.ComponentProps<"button">) {
  return <button type="button" className={cn("group relative flex min-h-[210px] w-full flex-col overflow-hidden rounded-2xl border bg-[var(--app-surface)] p-5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2", className)} {...props} />;
}
