"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Compass, Plus } from "lucide-react";
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
    <section className="overflow-hidden rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)]">
      <div className="flex min-h-48 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between md:p-7">
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
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-[var(--dashboard-accent-soft)] sm:h-36 sm:w-36 md:h-40 md:w-40">
          <Image
            src="/images/WelcomeBackBee.png"
            alt="BeeSmart welcome bee"
            width={200}
            height={200}
            priority
            className="h-auto w-24 sm:w-32 md:w-36"
          />
        </div>
      </div>
    </section>
  );
}
