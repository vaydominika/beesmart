import * as React from "react";
import { cn } from "@/lib/utils";

function WorkspacePageFrame({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-full bg-[var(--app-canvas)] px-4 py-5 md:px-6 md:py-7", className)} {...props}><div className="mx-auto max-w-[1500px]">{children}</div></div>;
}

type WorkspacePageHeaderProps = React.HTMLAttributes<HTMLElement> & {
  title: React.ReactNode;
  actions?: React.ReactNode;
  titleClassName?: string;
};

function WorkspacePageHeader({ title, actions, titleClassName, children, className, ...props }: WorkspacePageHeaderProps) {
  return (
    <header className={cn("mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)} {...props}>
      <div><h1 className={cn("text-3xl font-semibold tracking-[-0.04em] text-[var(--app-text)] md:text-[42px]", titleClassName)}>{title}</h1>{children}</div>
      {actions}
    </header>
  );
}

function LibraryToolbar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-5 flex flex-col gap-3 border-b border-[var(--app-border)] pb-4 lg:flex-row lg:items-center lg:justify-between", className)} {...props}>{children}</div>;
}

export { LibraryToolbar, WorkspacePageFrame, WorkspacePageHeader };
