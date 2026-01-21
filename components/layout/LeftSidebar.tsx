"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Lightbulb, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockStreak } from "@/lib/mockData";

const navigationItems = [
  { name: "DASHBOARD", href: "/" },
  { name: "SCHEDULE", href: "/schedule" },
  { name: "CLASSROOM", href: "/classroom" },
  { name: "PRACTICE", href: "/practice" },
];

export function LeftSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-[400px] bg-[#FFF6C4] flex flex-col min-h-screen">
      <div className="p-6">
        <div className="flex justify-center mb-6 -translate-x-1/18">
          <Image
            src="/svg/BeeSmartLogo.svg"
            alt="BeeSmart Logo"
            width={240}
            height={134}
            className="h-auto"
          />
        </div>
        
        <div className="bg-white rounded-lg p-4 mb-4">
          <p className="text-[32px] font-semibold text-[#262626] uppercase tracking-wide mb-3">
            BEE CONSISTENT
          </p>
          <div className="flex items-center gap-2">
            <div className="bg-[#FADA6D] rounded-lg px-4 py-2 flex items-center justify-center">
              <span className="text-[64px] font-bold text-[#262626]">{mockStreak}</span>
            </div>
            <span className="text-[64px] font-bold text-[#262626] uppercase">DAYS</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block px-4 py-3 text-[40px] font-semibold uppercase tracking-wide transition-colors rounded-lg",
                    isActive
                      ? "bg-[#FADA6D] text-[#262626]"
                      : "text-[#262626] hover:bg-[#FFF6C4]/80"
                  )}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 py-4 space-y-2">
        <button className="w-full flex items-center gap-3 px-4 py-3 text-[40px] font-semibold uppercase tracking-wide text-[#262626] hover:bg-[#FFF6C4]/80 transition-colors rounded-lg">
          <Lightbulb className="h-4 w-4 text-[#262626]" />
          FOCUS
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 text-[40px] font-semibold uppercase tracking-wide text-[#262626] hover:bg-[#FFF6C4]/80 transition-colors rounded-lg">
          <Settings className="h-4 w-4 text-[#262626]" />
          SETTINGS
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 text-[40px] font-semibold uppercase tracking-wide text-[#262626] hover:bg-[#FFF6C4]/80 transition-colors rounded-lg">
          <LogOut className="h-4 w-4 text-[#262626]" />
          LOG OUT
        </button>
      </div>
    </div>
  );
}
