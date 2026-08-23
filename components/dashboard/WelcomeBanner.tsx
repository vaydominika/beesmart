"use client";

import { useRouter } from "next/navigation";
import { Compass, Icon, Plus } from "lucide-react";
import { bee } from "@lucide/lab";
import { useDashboard } from "@/lib/DashboardContext";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { selectDailyWelcomeMessage } from "@/lib/dashboard";

export function WelcomeBanner() {
  const router = useRouter();
  const { data, loading } = useDashboard();
  const user = data?.user;
  const userName = user?.name?.trim() || "Learner";
  const message = user ? selectDailyWelcomeMessage(user.id) : null;
  const scrollToDiscover = () => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)]">
      <Icon
        iconNode={bee}
        aria-hidden="true"
        strokeWidth={1.15}
        className="pointer-events-none absolute -right-10 -top-4 h-52 w-52 -rotate-12 text-[var(--dashboard-accent)] opacity-30 sm:h-64 sm:w-64 md:-right-8 md:top-0"
      />
      <div className="relative z-10 flex min-h-48 flex-col justify-center gap-5 p-5 md:p-7 lg:pr-52">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--dashboard-text)] sm:text-3xl md:text-[38px]">
            Welcome back, {loading && !user ? "…" : userName}
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
