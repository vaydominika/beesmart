"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Clock3,
  Ellipsis,
  ExternalLink,
  LockKeyhole,
  Sparkles,
  X,
} from "lucide-react";
import { BeeAvatar } from "@/components/ui/BeeAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";

const COURSE_PREVIEW_LIMIT = 12;
const ACTIVITY_PREVIEW_LIMIT = 9;

type ProfileCourse = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
};

type ProfileActivity = {
  id: string;
  text: string;
  createdAt: string;
  actionUrl: string | null;
};

export type PublicProfileData = {
  id: string;
  name: string | null;
  avatar: string | null;
  bannerImageUrl: string | null;
  joinedAt: string;
  isOwner: boolean;
  isPrivate: boolean;
  activitySharing: boolean;
  courses: ProfileCourse[];
  activity: ProfileActivity[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function MoreToggle({
  expanded,
  hiddenCount,
  label,
  onClick,
}: {
  expanded: boolean;
  hiddenCount: number;
  label: string;
  onClick: () => void;
}) {
  if (!expanded && hiddenCount <= 0) return null;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onClick}
      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs font-semibold text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
    >
      {expanded ? <X className="h-3.5 w-3.5" /> : <Ellipsis className="h-4 w-4" />}
      {expanded ? `Close ${label}` : `${hiddenCount} more`}
    </button>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
  count,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <header className="mb-3 grid shrink-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3">
      <span className="flex h-9 w-9 items-center justify-center text-[var(--app-text)]">
        {icon}
      </span>
      <div className="flex min-h-9 min-w-0 flex-col justify-center">
        <h2 className="font-[var(--font-koulen)] text-xl leading-[0.9] tracking-[0.02em] text-[var(--app-text)]">
          {title}
        </h2>
        <p className="mt-1 text-[11px] font-medium leading-none text-[var(--app-text-faint)]">
          {subtitle}
        </p>
      </div>
      <span className="self-center rounded-full bg-[var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--app-text-muted)]">
        {count}
      </span>
    </header>
  );
}

export function PublicProfileContent({ profile }: { profile: PublicProfileData }) {
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const visibleCourses = showAllCourses ? profile.courses : profile.courses.slice(0, COURSE_PREVIEW_LIMIT);
  const visibleActivity = showAllActivity ? profile.activity : profile.activity.slice(0, ACTIVITY_PREVIEW_LIMIT);

  return (
    <div
      className="profile-ui min-h-[calc(100dvh-65px)] bg-[var(--app-canvas)] p-4 md:h-dvh md:min-h-0 md:overflow-hidden md:px-6 md:py-[max(1.5rem,calc((100%_-_1500px)/2))]"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 md:h-full md:min-h-0">
        <section className="relative shrink-0 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
          <div className="relative h-14 overflow-hidden border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] md:h-16">
            <Image
              src={profile.bannerImageUrl || "/images/default_banner.jpg"}
              alt=""
              fill
              priority
              className={profile.bannerImageUrl ? "object-cover object-center" : "object-cover object-top"}
              sizes="(max-width: 1024px) 100vw, 1500px"
              unoptimized
            />
          </div>

          <div className="relative flex min-h-18 flex-col justify-between gap-3 px-4 pb-3 sm:flex-row sm:items-end md:px-5">
            <div className="flex min-w-0 items-end gap-3">
              <div className="-mt-6 shrink-0">
                <BeeAvatar avatarUrl={profile.avatar} className="h-16 w-16" borderClassName="border-[var(--app-surface)]" />
              </div>
              <div className="min-w-0 pb-0.5">
                <h1 className="truncate font-[var(--font-koulen)] text-2xl leading-none tracking-[0.01em] text-[var(--app-text)] md:text-[32px]">
                  {profile.name || "BeeSmart learner"}
                </h1>
                <p className="mt-1 text-xs font-medium text-[var(--app-text-muted)]">
                  Learning with BeeSmart since {formatDate(profile.joinedAt)}
                </p>
              </div>
            </div>

            {profile.isOwner && profile.isPrivate && (
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-accent-text)]">
                <LockKeyhole className="h-3.5 w-3.5" />
                Your profile is private
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 md:min-h-0 md:flex-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
          <section className="flex min-h-0 flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:p-5">
            <SectionHeading
              icon={<BookOpen className="h-6 w-6" />}
              title="Published courses"
              subtitle="Newest first · showing up to 12"
              count={profile.courses.length}
            />

            {profile.courses.length ? (
              <>
                <ScrollArea className="h-[25rem] min-h-0 md:h-auto md:flex-1">
                  <div className="grid gap-2.5 pr-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleCourses.map((course) => (
                      <Link
                        key={course.id}
                        href={`/courses/${course.id}`}
                        className="group flex min-h-20 min-w-0 items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2.5 transition-colors hover:border-[var(--app-focus-border)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--app-accent-soft)]">
                          {course.coverImageUrl ? (
                            <Image src={course.coverImageUrl} alt="" fill className="object-cover" sizes="56px" unoptimized />
                          ) : (
                            <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-[var(--app-accent-text)]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-semibold text-[var(--app-text)]">{course.title}</p>
                          <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-[var(--app-text-muted)]">
                            {course.description || "Ready to explore"}
                          </p>
                          <p className="mt-1 text-[10px] font-medium text-[var(--app-text-faint)]">Updated {formatDate(course.updatedAt)}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--app-text-faint)] transition-colors group-hover:text-[var(--app-text)]" />
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
                <MoreToggle
                  expanded={showAllCourses}
                  hiddenCount={profile.courses.length - COURSE_PREVIEW_LIMIT}
                  label="courses"
                  onClick={() => setShowAllCourses((current) => !current)}
                />
              </>
            ) : (
              <div className="flex min-h-52 flex-1 items-center justify-center px-6 text-center text-sm text-[var(--app-text-muted)]">
                No public courses yet.
              </div>
            )}
          </section>

          {profile.activitySharing && (
            <section className="flex min-h-0 flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:p-5">
              <SectionHeading
                icon={<Sparkles className="h-6 w-6" />}
                title="Recent learning"
                subtitle="Latest 9 activities"
                count={profile.activity.length}
              />

              {profile.activity.length ? (
                <>
                  <ScrollArea className="h-[22rem] min-h-0 md:h-auto md:flex-1">
                    <ol className="space-y-1.5 pr-3">
                      {visibleActivity.map((item) => {
                        const activityContent = (
                          <>
                            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 self-start text-[var(--app-text-faint)]" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold leading-4 text-[var(--app-text)]">
                                {item.text}
                              </p>
                              <p className="mt-1 text-[10px] font-medium text-[var(--app-text-faint)]">
                                {formatDate(item.createdAt)}
                              </p>
                            </div>
                          </>
                        );

                        return (
                          <li key={item.id}>
                            {item.actionUrl ? (
                              <Link
                                href={item.actionUrl}
                                className="group flex min-h-12 w-full gap-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 transition-colors hover:border-[var(--app-focus-border)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
                              >
                                {activityContent}
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-[var(--app-text-faint)] transition-colors group-hover:text-[var(--app-text)]" />
                              </Link>
                            ) : (
                              <div className="flex min-h-12 w-full gap-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2">
                                {activityContent}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </ScrollArea>
                  <MoreToggle
                    expanded={showAllActivity}
                    hiddenCount={profile.activity.length - ACTIVITY_PREVIEW_LIMIT}
                    label="activity"
                    onClick={() => setShowAllActivity((current) => !current)}
                  />
                </>
              ) : (
                <div className="flex min-h-52 flex-1 items-center justify-center px-6 text-center text-sm text-[var(--app-text-muted)]">
                  No shared activity yet.
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
