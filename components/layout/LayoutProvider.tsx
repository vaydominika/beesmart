"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface LayoutContextType {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
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
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

  const toggleRightSidebar = () => {
    setIsRightSidebarOpen((prev) => !prev);
  };

  return (
    <LayoutContext.Provider value={{ headerContent, setHeaderContent, isRightSidebarOpen, toggleRightSidebar }}>
      {children}
    </LayoutContext.Provider>
  );
}
