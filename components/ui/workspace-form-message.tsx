"use client";

import { useText } from "@/i18n/use-text";
import * as React from "react";
import { cn } from "@/lib/utils";

type WorkspaceFormMessageProps = React.HTMLAttributes<HTMLParagraphElement> & {
  tone?: "danger" | "status";
};

function WorkspaceFormMessage({ tone = "danger", role, className, children, ...props }: WorkspaceFormMessageProps) {
  const t = useText();
  return (
    <p
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        tone === "danger"
          ? "border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] text-[var(--app-danger)]"
          : "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]",
        className,
      )}
      {...props}
    >{typeof children === "string" ? t(children) : children}</p>
  );
}

export { WorkspaceFormMessage };
