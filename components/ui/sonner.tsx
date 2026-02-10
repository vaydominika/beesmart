"use client"

import {
  Alert02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loader2Icon } from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" strokeWidth={2.5} />,
        info: <HugeiconsIcon icon={Alert02Icon} className="size-4" strokeWidth={2.5} />,
        warning: <HugeiconsIcon icon={Alert02Icon} className="size-4" strokeWidth={2.5} />,
        error: <HugeiconsIcon icon={CancelCircleIcon} className="size-4" strokeWidth={2.5} />,
        loading: <Loader2Icon className="size-4 animate-spin" strokeWidth={2.5} />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!border-dashed !border-4 !border-[var(--theme-text-important)] corner-squircle rounded-2xl !bg-[var(--theme-bg)] !text-[var(--theme-text)] font-bold shadow-none",
          title: "!font-bold text-[var(--theme-text)] uppercase",
          description: "!font-bold text-[var(--theme-text)]/80",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
