"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Lightbulb, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockStreak } from "@/lib/mockData";
import { useFocus } from "@/components/focus/FocusProvider";
import { FocusModal } from "@/components/focus/FocusModal";
import { useSettings } from "@/components/settings/SettingsProvider";
import { SettingsModal } from "@/components/settings/Settings";
import { FancyCard } from "@/components/ui/fancycard";

const navigationItems = [
  { name: "DASHBOARD", href: "/" },
  { name: "SCHEDULE", href: "/schedule" },
  { name: "CLASSROOM", href: "/classroom" },
  { name: "PRACTICE", href: "/practice" },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const { openModal } = useFocus();
  const { openModal: openSettingsModal } = useSettings();

  return (
    <div className="w-[400px] bg-(--theme-sidebar) flex flex-col h-screen rounded-tr-[30px] rounded-br-[30px] overflow-visible relative z-10" id="sidebar-container">
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
        
        <FancyCard className="mb-4 w-60 m-auto bg-(--theme-bg)">
          <div className="p-2">
            <p className="text-[32px] font-semibold text-(--theme-text) uppercase mb-3 justify-center flex">
              BEE CONSISTENT
            </p>
            <div className="flex items-center gap-2 justify-center">
              <FancyCard className="flex items-center justify-center h-20 bg-(--theme-sidebar)">
                <span className="text-[64px] font-bold text-(--theme-text) p-4">{mockStreak}</span>
              </FancyCard>
              <span className="text-[64px] font-bold text-(--theme-text) uppercase">DAYS</span>
            </div>
          </div>
        </FancyCard>
      </div>

      <nav className="flex-1 m-auto relative overflow-visible tracking-tight w-full pl-20">
        <ul className="overflow-visible relative space-y-2">
          {navigationItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href} className="relative h-14 overflow-visible">
                  {isActive && (
                    <Image
                      src="/svg/ActiveSidebarElement.svg"
                      alt="Active sidebar element"
                      width={348}
                      height={145}
                      className="absolute z-0 pointer-events-none left-0 right-0 sidebar-active-animation"
                      style={{ 
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    />
                  )}
                <div className="relative h-full overflow-visible">
                  <Link
                    href={item.href}
                    className={cn(
                      "block h-full px-6 mt-2 text-[40px] uppercase transition-all duration-300 relative z-10 items-center font-black",
                      isActive
                        ? "text-(--theme-text-important)"
                        : "text-(--theme-text) hover:text-(--theme-text-important)"
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
          className="w-full flex items-center gap-2 uppercase text-(--theme-text) hover:text-(--theme-text-important) transition-colors cursor-pointer"
        >
          <Lightbulb className="h-8 w-8 stroke-3" />
          FOCUS
        </button>
        <button 
          onClick={openSettingsModal}
          className="w-full flex items-center gap-2 uppercase text-(--theme-text) hover:text-(--theme-text-important) transition-colors cursor-pointer"
        >
          <Settings className="h-8 w-8 stroke-3" />
          SETTINGS
        </button>
        <button className="w-full flex items-center gap-2 uppercase text-(--theme-text) hover:text-(--theme-text-important) transition-colors cursor-pointer">
          <LogOut className="h-8 w-8 stroke-3" />
          LOG OUT
        </button>
      </div>
      
      <FocusModal />
    </div>
  );
}
