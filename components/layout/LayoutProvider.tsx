"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface LayoutContextType {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
  isLeftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  isRightSidebarOpen: boolean;
  toggleRightSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within LayoutProvider");
  }
  return context;
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsRightSidebarOpen(mq.matches);
    const handler = () => {
      setIsRightSidebarOpen(mq.matches);
      if (!mq.matches) setIsLeftSidebarOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleLeftSidebar = () => {
    setIsLeftSidebarOpen((prev) => !prev);
  };

  const toggleRightSidebar = () => {
    setIsRightSidebarOpen((prev) => !prev);
  };

  return (
    <LayoutContext.Provider
      value={{
        headerContent,
        setHeaderContent,
        isLeftSidebarOpen,
        toggleLeftSidebar,
        isRightSidebarOpen,
        toggleRightSidebar,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}
