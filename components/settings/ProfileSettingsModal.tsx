"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, ImageIcon, KeyRound, Upload, UserRound, type LucideIcon } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { BeeAvatar } from "../ui/BeeAvatar";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { WorkspaceButton } from "../ui/workspace-button";
import { WorkspaceTabs } from "../ui/workspace-tabs";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
} from "../ui/workspace-dialog";
import { toast } from "@/components/ui/sonner";
import { useDashboard } from "@/lib/DashboardContext";
import { cn } from "@/lib/utils";
import { useSettings } from "./SettingsProvider";

type ProfileSection = "profile" | "images" | "privacy" | "password";
const sections: Array<{ value: ProfileSection; label: string; icon: LucideIcon }> = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "images", label: "Images", icon: ImageIcon },
  { value: "privacy", label: "Privacy", icon: Eye },
  { value: "password", label: "Password", icon: KeyRound },
];

export function ProfileSettingsModal() {
  const router = useRouter();
  const {
    isProfileModalOpen,
    closeProfileModal,
    profileVisibility,
    activitySharing,
    setProfileVisibility,
    setActivitySharing,
    saveSettingsToServer,
    isSaving: isSavingSettings,
  } = useSettings();
  const { data, refetch } = useDashboard();
  const user = data?.user;
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isProfileModalOpen || !user) return;
    setActiveSection("profile");
    setName(user.name);
    setAvatarUrl(user.avatar ?? "");
    setBannerImageUrl(user.bannerImageUrl ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setUploadError(null);
  }, [isProfileModalOpen, user]);

  const uploadProfileImage = async (file: File, type: "avatar" | "banner") => {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/upload/profile-image?type=${type}`, { method: "POST", body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Upload failed");
    return result.url as string;
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingAvatar(true);
    try {
      setAvatarUrl(await uploadProfileImage(file, "avatar"));
    } catch (uploadFailure) {
      const message = uploadFailure instanceof Error ? uploadFailure.message : "Avatar upload failed";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const handleBannerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingBanner(true);
    try {
      setBannerImageUrl(await uploadProfileImage(file, "banner"));
    } catch (uploadFailure) {
      const message = uploadFailure instanceof Error ? uploadFailure.message : "Banner upload failed";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploadingBanner(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    setError(null);
    setUploadError(null);
    if (newPassword && newPassword !== confirmPassword) {
      setActiveSection("password");
      setError("New passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          avatar: avatarUrl.trim() || null,
          bannerImageUrl: bannerImageUrl.trim() || null,
          ...(currentPassword && newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Failed to update profile");
      }
      if (!(await saveSettingsToServer({ profileVisibility, activitySharing }))) {
        throw new Error("Profile updated, but privacy settings could not be saved.");
      }
      await refetch();
      toast.success("Profile updated");
      closeProfileModal();
    } catch (saveFailure) {
      const message = saveFailure instanceof Error ? saveFailure.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSavingSettings || uploadingAvatar || uploadingBanner;

  return (
    <Dialog open={isProfileModalOpen} onOpenChange={(open) => !open && closeProfileModal()}>
      <WorkspaceDialogContent className="h-[min(760px,90vh)] max-w-3xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent-text)]"><UserRound className="h-4 w-4" /></span>
            Profile settings
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>Update your identity, images, privacy, and password.</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav aria-label="Profile settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2 sm:w-48 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-3">
            {sections.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setActiveSection(value)} aria-current={activeSection === value ? "page" : undefined} className={cn("flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]", activeSection === value && "bg-[var(--app-settings-active)] text-[var(--app-text)]")}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
            {user?.id ? (
              <button type="button" onClick={() => { closeProfileModal(); router.push(`/profile/${user.id}`); }} className="mt-auto hidden items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] sm:flex"><ExternalLink className="h-3.5 w-3.5" />View profile</button>
            ) : null}
          </nav>

          <WorkspaceDialogBody className="w-full">
            {activeSection === "profile" ? (
              <section aria-labelledby="profile-heading" className="space-y-5">
                <div><h3 id="profile-heading" className="text-base font-semibold text-[var(--app-text)]">Profile</h3><p className="mt-1 text-sm text-[var(--app-text-muted)]">This is the name people see across BeeSmart.</p></div>
                <div><label htmlFor="profile-name" className={workspaceLabelClass}>Name</label><Input id="profile-name" type="text" value={name} onChange={(event) => setName(event.target.value)} className={cn(workspaceFieldClass, "w-full")} placeholder="Your name" /></div>
                {user?.id ? <WorkspaceButton type="button" variant="ghost" onClick={() => { closeProfileModal(); router.push(`/profile/${user.id}`); }} className="sm:hidden"><ExternalLink className="h-4 w-4" />View profile</WorkspaceButton> : null}
              </section>
            ) : null}

            {activeSection === "images" ? (
              <section aria-labelledby="images-heading" className="space-y-6">
                <div><h3 id="images-heading" className="text-base font-semibold text-[var(--app-text)]">Images</h3><p className="mt-1 text-sm text-[var(--app-text-muted)]">Choose a recognizable avatar and a profile banner.</p></div>
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                  <p className={workspaceLabelClass}>Profile picture</p>
                  <div className="flex items-center gap-4"><BeeAvatar avatarUrl={avatarUrl || undefined} className="shrink-0" /><div><Input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarFileChange} /><WorkspaceButton type="button" variant="secondary" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}><Upload className="h-4 w-4" />{uploadingAvatar ? "Uploading…" : "Upload avatar"}</WorkspaceButton></div></div>
                </div>
                <div>
                  <p className={workspaceLabelClass}>Banner</p>
                  <div className="relative h-28 w-full overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-accent-soft)]"><Image src={bannerImageUrl || "/images/BannerBackground.avif"} alt="Banner preview" fill sizes="(max-width: 768px) 100vw, 512px" className="object-cover" unoptimized /></div>
                  <Input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleBannerFileChange} />
                  <WorkspaceButton type="button" variant="secondary" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner} className="mt-3"><Upload className="h-4 w-4" />{uploadingBanner ? "Uploading…" : "Upload banner"}</WorkspaceButton>
                </div>
              </section>
            ) : null}

            {activeSection === "privacy" ? (
              <section aria-labelledby="privacy-heading" className="space-y-5">
                <div><h3 id="privacy-heading" className="text-base font-semibold text-[var(--app-text)]">Privacy</h3><p className="mt-1 text-sm text-[var(--app-text-muted)]">Choose who can see your profile and learning activity.</p></div>
                <div><p className={workspaceLabelClass}>Profile visibility</p><WorkspaceTabs ariaLabel="Profile visibility" items={[{ value: "public", label: "Public" }, { value: "private", label: "Private" }]} value={profileVisibility} onValueChange={setProfileVisibility} fill /></div>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] p-4"><div><label htmlFor="activity-sharing" className="text-sm font-semibold text-[var(--app-text)]">Share learning activity</label><p className="mt-0.5 text-xs leading-4 text-[var(--app-text-muted)]">Show recent learning activity on your profile.</p></div><Switch id="activity-sharing" checked={activitySharing} onCheckedChange={setActivitySharing} /></div>
              </section>
            ) : null}

            {activeSection === "password" ? (
              <section aria-labelledby="password-heading" className="space-y-4">
                <div><h3 id="password-heading" className="text-base font-semibold text-[var(--app-text)]">Password</h3><p className="mt-1 text-sm text-[var(--app-text-muted)]">Leave these fields blank to keep your current password.</p></div>
                <PasswordField id="current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} />
                <PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} />
                <PasswordField id="confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
              </section>
            ) : null}

            {error || uploadError ? <p role="alert" className="mt-5 rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] px-3 py-2 text-sm text-[var(--app-danger)]">{error ?? uploadError}</p> : null}
          </WorkspaceDialogBody>
        </div>

        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={closeProfileModal} disabled={busy}>Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={handleSave} disabled={busy}>{saving ? "Saving…" : "Save changes"}</WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className={workspaceLabelClass}>{label}</label><Input id={id} type="password" value={value} onChange={(event) => onChange(event.target.value)} className={cn(workspaceFieldClass, "w-full")} /></div>;
}
