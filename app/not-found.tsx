"use client";

import Link from "next/link";
import { WorkspaceButton } from "@/components/ui/workspace-button";

export default function NotFound() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-(--theme-bg) p-4">
            <div className="flex flex-col items-center gap-8 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-(--theme-sidebar) p-12 md:flex-row">
                <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                    <h1 className="text-6xl md:text-8xl font-bold text-(--theme-text-important) mb-2">404</h1>
                    <h2 className="text-2xl md:text-3xl font-bold text-(--theme-text) uppercase mb-4 leading-tight">
                        LOOKS LIKE YOU&apos;VE<br />FLOWN TOO FAR!
                    </h2>

                    <p className="text-(--theme-text) opacity-80 mb-8 text-lg">
                        This page is missing from the hive.
                    </p>

                    <WorkspaceButton asChild variant="primary" className="w-full md:w-auto">
                        <Link href="/dashboard">Fly back home</Link>
                    </WorkspaceButton>
                </div>
            </div>
        </div>
    );
}
