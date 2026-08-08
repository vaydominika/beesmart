import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock3, LockKeyhole, Sparkles } from "lucide-react";
import { BeeAvatar } from "@/components/ui/BeeAvatar";
import { getCurrentUserId } from "@/lib/db";
import { getPublicProfile } from "@/lib/public-profile";

export default async function PublicProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const viewerUserId = await getCurrentUserId();
  const { userId } = await params;
  if (!viewerUserId) return null;
  const result = await getPublicProfile(userId, viewerUserId);

  if (result.status === "not_found" || result.status === "private") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-5 py-12">
        <div className="w-full rounded-3xl border border-(--app-border) bg-(--app-surface) p-8 text-center shadow-sm">
          <LockKeyhole className="mx-auto h-10 w-10 text-(--app-text-muted)" />
          <h1 className="mt-4 text-2xl font-semibold text-(--app-text)">{result.status === "private" ? "This profile is private" : "Profile not found"}</h1>
          <p className="mt-2 text-sm text-(--app-text-muted)">{result.status === "private" ? "This learner has chosen not to share their BeeSmart profile." : "The profile may have been removed."}</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-(--app-accent-soft) px-4 py-2 text-sm font-semibold text-(--app-text)">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const profile = result.profile;
  return (
    <div className="profile-ui mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <section className="overflow-hidden rounded-3xl border border-(--app-border) bg-(--app-surface) shadow-sm">
        <div className="relative h-36 bg-[#fef9c3] md:h-52">
          <Image src={profile.bannerImageUrl || "/images/BannerBackground.png"} alt="" fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 960px" unoptimized />
        </div>
        <div className="relative px-5 pb-6 md:px-8 md:pb-8">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="rounded-full border-4 border-(--app-surface) bg-(--app-surface)"><BeeAvatar avatarUrl={profile.avatar} className="h-20 w-20 md:h-24 md:w-24" /></div>
              <div className="pb-1"><h1 className="text-3xl font-semibold text-(--app-text) md:text-4xl">{profile.name}</h1><p className="mt-1 text-sm text-(--app-text-muted)">Learning with BeeSmart since {new Date(profile.joinedAt).toLocaleDateString()}</p></div>
            </div>
            {profile.isOwner && profile.isPrivate && <div className="inline-flex items-center gap-2 rounded-full bg-(--app-accent-soft) px-3 py-1.5 text-xs font-semibold text-(--app-text)"><LockKeyhole className="h-3.5 w-3.5" /> Private preview</div>}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-(--app-border) bg-(--app-surface) p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5 text-(--app-focus-border)" /><h2 className="text-lg font-semibold text-(--app-text)">Published courses</h2></div>
          {profile.courses.length ? <div className="grid gap-3 sm:grid-cols-2">{profile.courses.map((course: { id: string; title: string; description: string | null }) => <Link key={course.id} href={`/courses/${course.id}`} className="group rounded-2xl border border-(--app-border) bg-(--app-surface-muted) p-4 transition-colors hover:bg-(--app-accent-soft)"><p className="font-semibold text-(--app-text)">{course.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-(--app-text-muted)">{course.description || "A BeeSmart course ready to explore."}</p></Link>)}</div> : <p className="rounded-2xl bg-(--app-surface-muted) p-5 text-sm text-(--app-text-muted)">No public courses yet.</p>}
        </section>

        {profile.activitySharing && <section className="rounded-3xl border border-(--app-border) bg-(--app-surface) p-5 md:p-6"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-(--app-focus-border)" /><h2 className="text-lg font-semibold text-(--app-text)">Recent learning</h2></div>{profile.activity.length ? <ol className="space-y-3">{profile.activity.map((item) => <li key={item.id} className="flex gap-3 rounded-2xl bg-(--app-surface-muted) p-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-(--app-text-faint)" /><div><p className="text-sm font-medium text-(--app-text)">{item.actionUrl ? <Link href={item.actionUrl} className="hover:underline">{item.text}</Link> : item.text}</p><p className="mt-1 text-[11px] text-(--app-text-faint)">{new Date(item.createdAt).toLocaleDateString()}</p></div></li>)}</ol> : <p className="rounded-2xl bg-(--app-surface-muted) p-5 text-sm text-(--app-text-muted)">No shared activity yet.</p>}</section>}
      </div>
    </div>
  );
}
