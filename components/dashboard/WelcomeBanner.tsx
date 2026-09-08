"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, Icon, Plus, type IconNode } from "lucide-react";
import { useDashboard } from "@/lib/DashboardContext";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { FIRST_LOGIN_WELCOME_MESSAGE, selectDailyWelcomeMessage } from "@/lib/dashboard";

const beeIcon: IconNode = [
  ["path", { d: "m8 2 1.88 1.88", key: "fmnt4t" }],
  ["path", { d: "M14.12 3.88 16 2", key: "qol33r" }],
  ["path", { d: "M9 7V6a3 3 0 1 1 6 0v1", key: "ygny09" }],
  ["path", { d: "M5 7a3 3 0 1 0 2.2 5.1C9.1 10 12 7 12 7s2.9 3 4.8 5.1A3 3 0 1 0 19 7Z", key: "alnxb1" }],
  ["path", { d: "M7.56 12h8.87", key: "zy8tq7" }],
  ["path", { d: "M7.5 17h9", key: "12rbth" }],
  ["path", { d: "M15.5 10.7c.9.9 1.4 2.1 1.5 3.3 0 5.8-5 8-5 8s-5-2.2-5-8c.1-1.2.6-2.4 1.5-3.3", key: "1x6v6g" }],
];

export function WelcomeBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading } = useDashboard();
  const user = data?.user;
  const userName = user?.name?.trim() || "Learner";
  const [isFirstLogin] = useState(() => searchParams.get("welcome") === "new");
  const message = user
    ? isFirstLogin
      ? FIRST_LOGIN_WELCOME_MESSAGE
      : selectDailyWelcomeMessage(user.id)
    : null;
  const scrollToDiscover = () => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (!isFirstLogin || searchParams.get("welcome") !== "new") return;

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("welcome");
    const query = nextSearchParams.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard", { scroll: false });
  }, [isFirstLogin, router, searchParams]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)]">
      <Icon
        iconNode={beeIcon}
        aria-hidden="true"
        strokeWidth={1.15}
        className="pointer-events-none absolute -right-10 -top-4 h-52 w-52 -rotate-12 text-[var(--dashboard-accent)] opacity-30 sm:h-64 sm:w-64 md:-right-8 md:top-0"
      />
      <div className="relative z-10 flex min-h-48 flex-col justify-center gap-5 p-5 md:p-7 lg:pr-52">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--dashboard-text)] sm:text-3xl md:text-[38px]">
            {isFirstLogin ? "Welcome" : "Welcome back"}, {loading && !user ? "…" : userName}
          </h2>
          <p className="mt-2 max-w-3xl text-base font-medium leading-relaxed text-[var(--dashboard-text-muted)] md:text-xl">
            {message ?? "The hive is getting things ready…"}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <WorkspaceButton type="button" variant="primary" onClick={scrollToDiscover}>
              <Compass className="h-4 w-4" /> Explore courses
            </WorkspaceButton>
            <WorkspaceButton type="button" variant="secondary" onClick={() => router.push("/courses")}>
              <Plus className="h-4 w-4" /> Make your own
            </WorkspaceButton>
          </div>
        </div>
      </div>
    </section>
  );
}
