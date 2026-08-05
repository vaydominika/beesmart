import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const workspaceButtonVariants = cva(
  "workspace-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-[var(--font-geist-sans)] font-semibold normal-case tracking-normal transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:border-[var(--app-border)] disabled:bg-[var(--app-surface-muted)] disabled:text-[var(--app-text-faint)] disabled:opacity-100",
  {
    variants: {
      variant: {
        primary: "border border-[var(--app-accent-hover)] bg-[var(--app-accent-soft)] text-[var(--app-text)] hover:bg-[var(--app-accent-hover)] focus-visible:border-[var(--app-focus-border)]",
        secondary: "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:border-[var(--app-focus-border)]",
        danger: "border border-[var(--app-border)] bg-[var(--app-danger-soft)] text-[var(--app-danger)] hover:border-[var(--app-danger)] focus-visible:border-[var(--app-danger)] focus-visible:ring-[var(--app-danger-soft)]",
        ghost: "border border-transparent bg-transparent text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:border-[var(--app-focus-border)]",
      },
      size: {
        default: "h-9 rounded-xl px-4 text-sm",
        compact: "h-8 rounded-lg px-3 text-xs",
        icon: "h-9 w-9 rounded-xl p-0 text-sm",
        "icon-compact": "h-8 w-8 rounded-lg p-0 text-xs",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

type WorkspaceButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof workspaceButtonVariants> & {
    asChild?: boolean;
  };

function WorkspaceButton({
  className,
  variant = "secondary",
  size = "default",
  asChild = false,
  ...props
}: WorkspaceButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="workspace-button"
      data-variant={variant}
      data-size={size}
      className={cn(workspaceButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { WorkspaceButton, workspaceButtonVariants };
export type { WorkspaceButtonProps };
