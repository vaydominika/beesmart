"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Lightbulb, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockStreak } from "@/lib/mockData";
import { useFocus } from "@/components/focus/FocusProvider";
import { FocusModal } from "@/components/focus/FocusModal";

const navigationItems = [
  { name: "DASHBOARD", href: "/" },
  { name: "SCHEDULE", href: "/schedule" },
  { name: "CLASSROOM", href: "/classroom" },
  { name: "PRACTICE", href: "/practice" },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const { openModal } = useFocus();

  return (
    <div className="w-[400px] bg-[var(--theme-sidebar)] flex flex-col min-h-screen rounded-tr-[30px] rounded-br-[30px]">
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
        
        <div className="bg-white rounded-[30px] p-4 mb-4 w-55 m-auto">
          <p className="text-[32px] font-semibold text-[var(--theme-text)] uppercase mb-3 justify-center flex">
            BEE CONSISTENT
          </p>
          <div className="flex items-center gap-2 justify-center">
            <div className="bg-[var(--theme-card)] rounded-[20px] px-4 py-2 flex items-center justify-center h-19">
              <span className="text-[64px] font-bold text-[var(--theme-text)]">{mockStreak}</span>
            </div>
            <span className="text-[64px] font-bold text-[var(--theme-text)] uppercase">DAYS</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 m-auto relative">
        <ul>
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href} className="relative h-12">
                <div className="relative h-full">
                  <Link
                    href={item.href}
                    className={cn(
                      "block h-full px-6 mt-2 text-[40px] uppercase transition-all duration-300 relative z-10 flex items-center font-black",
                      isActive
                        ? "bg-[var(--theme-bg)] text-[var(--theme-text)] rounded-l-2xl"
                        : "text-[var(--theme-text)] hover:text-[var(--theme-card)]"
                    )}
                  >
                    {item.name}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="py-4 m-auto tracking-tighter text-[32px]">
        <button 
          onClick={openModal}
          className="w-full flex items-center gap-2 uppercase text-[var(--theme-text)] hover:text-[var(--theme-card)] transition-colors cursor-pointer"
        >
          <Lightbulb className="h-8 w-8 stroke-3" />
          FOCUS
        </button>
        <button className="w-full flex items-center gap-2 uppercase text-[var(--theme-text)] hover:text-[var(--theme-card)] transition-colors cursor-pointer">
          <Settings className="h-8 w-8 stroke-3" />
          SETTINGS
        </button>
        <button className="w-full flex items-center gap-2 uppercase text-[var(--theme-text)] hover:text-[var(--theme-card)] transition-colors cursor-pointer">
          <LogOut className="h-8 w-8 stroke-3" />
          LOG OUT
        </button>
      </div>
      
      <FocusModal />
    </div>
  );
}
