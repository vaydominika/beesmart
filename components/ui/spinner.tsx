"use client";

import { useText } from "@/i18n/use-text";
import { LoaderIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const t = useText();
  return (
    <LoaderIcon
      role="status"
      aria-label={t("Loading")}
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
}
