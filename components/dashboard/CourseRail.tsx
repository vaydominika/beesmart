"use client";

import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkspaceButton } from "@/components/ui/workspace-button";

interface CourseRailProps {
  title: string;
  id?: string;
  children: ReactNode;
}

export function CourseRail({ title, id, children }: CourseRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateControls = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollLeft(rail.scrollLeft > 2);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateControls();
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(updateControls);
    observer.observe(rail);
    for (const child of Array.from(rail.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [children, updateControls]);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * rail.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <section id={id} aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase tracking-tight text-(--theme-text) md:text-[40px]">{title}</h2>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex shrink-0 gap-2" aria-label={`${title} navigation`}>
            <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => move(-1)} disabled={!canScrollLeft} aria-label={`Previous ${title.toLowerCase()}`}><ChevronLeft className="h-4 w-4" /></WorkspaceButton>
            <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => move(1)} disabled={!canScrollRight} aria-label={`Next ${title.toLowerCase()}`}><ChevronRight className="h-4 w-4" /></WorkspaceButton>
          </div>
        )}
      </div>
      <div ref={railRef} onScroll={updateControls} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Children.map(children, (child) => (
          <div className="min-w-0 shrink-0 basis-full snap-start md:basis-[calc((100%_-_1rem)/2)] lg:basis-[calc((100%_-_2rem)/3)]">{child}</div>
        ))}
      </div>
    </section>
  );
}
