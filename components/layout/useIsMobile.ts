"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => setIsMobile(!mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
