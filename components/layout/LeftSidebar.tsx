"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Lightbulb, Settings, LogOut, X } from "lucide-react";
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

interface LeftSidebarProps {
  variant?: "inline" | "overlay";
  onClose?: () => void;
}

export function LeftSidebar({ variant = "inline", onClose }: LeftSidebarProps) {
  const pathname = usePathname();
  const { openModal } = useFocus();
  const { openModal: openSettingsModal } = useSettings();
  const isOverlay = variant === "overlay";

  return (
    <div
      className={cn(
        "bg-(--theme-sidebar) flex flex-col rounded-tr-[30px] rounded-br-[30px] overflow-visible relative z-10 w-full",
        isOverlay ? "h-screen max-w-[85vw]" : "h-full w-72"
      )}
      id="sidebar-container"
    >
      <div className="p-6 md:p-4">
        {isOverlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="absolute top-4 right-4 p-2 rounded-md hover:bg-(--theme-sidebar)/80 text-(--theme-text)"
          >
            <X className="h-6 w-6" />
          </button>
        )}
        <div className="flex justify-center mb-6 md:mb-4 -translate-x-1/18">
          <Image
            src="/svg/BeeSmartLogo.svg"
            alt="BeeSmart Logo"
            width={240}
            height={134}
            className="h-auto w-60 md:w-40"
          />
        </div>
        
        <FancyCard className="mb-4 w-60 md:w-42 m-auto bg-(--theme-bg)">
          <div className="p-2">
            <p className="text-[32px] md:text-xl font-semibold text-(--theme-text) uppercase mb-3 md:mb-2 justify-center flex">
              BEE CONSISTENT
            </p>
            <div className="flex items-center gap-2 md:gap-2 justify-center">
              <FancyCard className="flex items-center justify-center bg-(--theme-sidebar)">
                <span className="text-[64px] md:text-[48px] font-bold text-(--theme-text) p-4">{mockStreak}</span>
              </FancyCard>
              <span className="text-[64px] md:text-4xl font-bold text-(--theme-text) uppercase">DAYS</span>
            </div>
          </div>
        </FancyCard>
      </div>

      <nav className="flex-1 m-auto relative overflow-visible tracking-tight w-full pl-20 md:pl-15">
        <ul className="overflow-visible relative space-y-2">
          {navigationItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href} className="relative h-14 md:h-10 overflow-visible">
                  {isActive && (
                    <Image
                      src="/svg/ActiveSidebarElement.svg"
                      alt="Active sidebar element"
                      width={348}
                      height={145}
                      className="absolute z-0 pointer-events-none left-0 right-0 sidebar-active-animation md:translate-y-1.5"
                      style={{ 
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    />
                  )}
                <div className="relative h-full overflow-visible">
                  <Link
                    href={item.href}
                    onClick={isOverlay ? onClose : undefined}
                    className={cn(
                      "block h-full px-6 md:px-4 mt-2 text-[40px] md:text-[36px] uppercase transition-all duration-300 relative z-10 items-center font-black",
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

      <div className="py-4 md:py-3 m-auto tracking-tighter text-[32px] md:text-[30px]">
        <button 
          onClick={openModal}
          className="w-full flex items-center gap-2 uppercase text-(--theme-text) hover:text-(--theme-text-important) transition-colors cursor-pointer"
        >
          <Lightbulb className="h-8 w-8 md:h-6 md:w-6 stroke-3" />
          FOCUS
        </button>
        <button 
          onClick={openSettingsModal}
          className="w-full flex items-center gap-2 uppercase text-(--theme-text) hover:text-(--theme-text-important) transition-colors cursor-pointer"
        >
          <Settings className="h-8 w-8 md:h-6 md:w-6 stroke-3" />
          SETTINGS
        </button>
        <button className="w-full flex items-center gap-2 uppercase text-(--theme-text) hover:text-(--theme-text-important) transition-colors cursor-pointer">
          <LogOut className="h-8 w-8 md:h-6 md:w-6 stroke-3" />
          LOG OUT
        </button>
      </div>
      
      <FocusModal />
    </div>
  );
}
