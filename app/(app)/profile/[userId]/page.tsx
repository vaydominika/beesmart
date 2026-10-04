import { getTranslations } from "next-intl/server";

import { getText } from "@/i18n/server";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { PublicProfileContent } from "@/components/profile/PublicProfileContent";
import { WorkspacePageFrame } from "@/components/ui/workspace-page";
import { getCurrentUserId } from "@/lib/db";
import { getPublicProfile } from "@/lib/public-profile";

export default async function PublicProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const t = await getText();
  const activityText = await getTranslations("Activity");
  const viewerUserId = await getCurrentUserId();
  const { userId } = await params;
  if (!viewerUserId) return null;
  const result = await getPublicProfile(userId, viewerUserId, activityText);

  if (result.status === "not_found" || result.status === "private") {
    return (
      <WorkspacePageFrame contentClassName="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-(--app-border) bg-(--app-surface) p-8 text-center shadow-sm">
          <LockKeyhole className="mx-auto h-10 w-10 text-(--app-text-muted)" />
          <h1 className="mt-4 text-2xl font-semibold text-(--app-text)">{result.status === "private" ? t("This is a private profile") : t("Profile not found")}</h1>
          <p className="mt-2 text-sm text-(--app-text-muted)">{result.status === "private" ? t("This learner has chosen not to share their BeeSmart profile.") : t("The profile may have been removed.")}</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-(--app-accent-soft) px-4 py-2 text-sm font-semibold text-(--app-text)">{t("Back to dashboard")}</Link>
        </div>
      </WorkspacePageFrame>
    );
  }

  return <PublicProfileContent profile={result.profile} />;
}
