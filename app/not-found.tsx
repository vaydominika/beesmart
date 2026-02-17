"use client";

import Link from "next/link";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";

export default function NotFound() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-(--theme-bg) p-4">
            <FancyCard className="p-12 flex flex-col md:flex-row items-center gap-8 bg-(--theme-sidebar)">
                <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                    <h1 className="text-6xl md:text-8xl font-bold text-(--theme-text-important) mb-2">404</h1>
                    <h2 className="text-2xl md:text-3xl font-bold text-(--theme-text) uppercase mb-4 leading-tight">
                        LOOKS LIKE YOU'VE<br />FLOWN TOO FAR!
                    </h2>

                    <p className="text-(--theme-text) opacity-80 mb-8 text-lg">
                        This page is missing from the hive.
                    </p>

                    <Link href="/dashboard" className="w-full md:w-auto">
                        <FancyButton className="w-full md:w-auto px-8 text-(--theme-text) font-bold uppercase py-4">
                            Fly Back Home
                        </FancyButton>
                    </Link>
                </div>
            </FancyCard>
        </div>
    );
}
