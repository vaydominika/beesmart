"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;
const RIGHT_SIDEBAR_INLINE_BREAKPOINT = 1200;

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

export function useHasRoomForRightSidebar(): boolean {
  const [hasRoom, setHasRoom] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${RIGHT_SIDEBAR_INLINE_BREAKPOINT}px)`);
    const handler = () => setHasRoom(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return hasRoom;
}
