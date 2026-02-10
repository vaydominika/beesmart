"use client";

import { useState, useEffect, useRef } from "react";
import { FancyCard } from "../ui/fancycard";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { UserIcon, Upload } from "lucide-react";
import { FancyButton } from "../ui/fancybutton";
import { Input } from "../ui/input";
import { useSettings } from "./SettingsProvider";
import { useDashboard } from "@/lib/DashboardContext";
import { ScrollArea } from "../ui/scroll-area";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { BeeAvatar } from "../ui/BeeAvatar";
import Image from "next/image";
import { toast } from "@/components/ui/sonner";

export function ProfileSettingsModal() {
  const { isProfileModalOpen, closeProfileModal } = useSettings();
  const { data, refetch } = useDashboard();
  const user = data?.user;

  const [name, setName] = useState("");
  const [roleDisplay, setRoleDisplay] = useState("");
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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: true,
    picture: false,
    banner: false,
    security: false,
  });

  useEffect(() => {
    if (isProfileModalOpen && user) {
      setName(user.name);
      setRoleDisplay(user.role);
      setAvatarUrl(user.avatar ?? "");
      setBannerImageUrl(user.bannerImageUrl ?? "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setUploadError(null);
    }
  }, [isProfileModalOpen, user]);

  const uploadProfileImage = async (
    file: File,
    type: "avatar" | "banner"
  ): Promise<string> => {
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch(
      `/api/upload/profile-image?type=${type}`,
      { method: "POST", body: formData }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Upload failed");
    return json.url;
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingAvatar(true);
    try {
      const url = await uploadProfileImage(file, "avatar");
      setAvatarUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Avatar upload failed";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleBannerFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingBanner(true);
    try {
      const url = await uploadProfileImage(file, "banner");
      setBannerImageUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Banner upload failed";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async () => {
    setError(null);
    setUploadError(null);
    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          avatar: avatarUrl.trim() || null,
          bannerImageUrl: bannerImageUrl.trim() || null,
          ...(currentPassword && newPassword
            ? { currentPassword, newPassword }
            : {}),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to update profile");
      }
      await refetch();
      toast.success("Profile updated");
      closeProfileModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isProfileModalOpen} onOpenChange={closeProfileModal}>
      <DialogContent className="p-0 max-w-2xl max-h-[85vh] border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
        <FancyCard className="bg-(--theme-bg) p-4 md:p-10 flex flex-col max-h-[85vh] md:max-h-[82vh] overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 md:pb-0">
            <DialogTitle className="flex items-center gap-2 text-xl md:text-[40px] font-bold text-(--theme-text) uppercase">
              <UserIcon className="h-6 w-6 md:w-12 md:h-12" />
              PROFILE SETTINGS
            </DialogTitle>
          </DialogHeader>

          <div className="my-2 md:my-8 flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-[35vh] md:h-[40vh] pr-2">
              <div className="space-y-8 px-2 pb-4">
                {/* Profile: name, role */}
                <div>
                  <button
                    onClick={() => toggleSection("profile")}
                    className="w-full flex items-center justify-between text-base md:text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                  >
                    <span>PROFILE</span>
                    {openSections.profile ? (
                      <ChevronUp className="h-4 w-4 md:h-6 md:w-6" />
                    ) : (
                      <ChevronDown className="h-4 w-4 md:h-6 md:w-6" />
                    )}
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                      openSections.profile
                        ? "max-h-[600px] opacity-100"
                        : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                          NAME
                        </label>
                        <Input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                          ROLE
                        </label>
                        <p className="text-base md:text-[22px] font-bold text-(--theme-text) bg-(--theme-sidebar) rounded-xl corner-squircle px-4 py-3">
                          {roleDisplay}
                        </p>
                        <p className="text-xs md:text-sm text-(--theme-text)/70 mt-1">
                          Role is set by your classroom membership.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile picture */}
                <div>
                  <button
                    onClick={() => toggleSection("picture")}
                    className="w-full flex items-center justify-between text-base md:text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                  >
                    <span>PROFILE PICTURE</span>
                    {openSections.picture ? (
                      <ChevronUp className="h-4 w-4 md:h-6 md:w-6" />
                    ) : (
                      <ChevronDown className="h-4 w-4 md:h-6 md:w-6" />
                    )}
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                      openSections.picture
                        ? "max-h-[600px] opacity-100"
                        : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-4 pt-4">
                      <BeeAvatar
                        avatarUrl={avatarUrl || undefined}
                        className="shrink-0"
                      />
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                      <FancyButton
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="text-(--theme-text) text-[36px] md:text-[28px] font-bold uppercase flex items-center"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        <span>{uploadingAvatar ? "UPLOADING…" : "UPLOAD IMAGE"}</span>
                      </FancyButton>
                    </div>
                  </div>
                </div>

                {/* Banner */}
                <div>
                  <button
                    onClick={() => toggleSection("banner")}
                    className="w-full flex items-center justify-between text-base md:text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                  >
                    <span>BANNER</span>
                    {openSections.banner ? (
                      <ChevronUp className="h-4 w-4 md:h-6 md:w-6" />
                    ) : (
                      <ChevronDown className="h-4 w-4 md:h-6 md:w-6" />
                    )}
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                      openSections.banner
                        ? "max-h-[600px] opacity-100"
                        : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="pt-4 space-y-4">
                      <div className="w-full min-w-[200px] h-20 min-h-[80px] rounded-xl overflow-hidden border border-(--theme-card) bg-[#fef9c3] relative">
                        <Image
                          src={bannerImageUrl ? bannerImageUrl : "/images/BannerBackground.png"}
                          alt="Banner preview"
                          fill
                          sizes="(max-width: 768px) 100vw, 512px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleBannerFileChange}
                      />
                      <FancyButton
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={uploadingBanner}
                        className="text-(--theme-text) text-[36px] md:text-[28px] font-bold uppercase flex items-center"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        <span>{uploadingBanner ? "UPLOADING…" : "UPLOAD IMAGE"}</span>
                      </FancyButton>
                    </div>
                  </div>
                </div>

                {/* Security / Password */}
                <div>
                  <button
                    onClick={() => toggleSection("security")}
                    className="w-full flex items-center justify-between text-base md:text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                  >
                    <span>PASSWORD</span>
                    {openSections.security ? (
                      <ChevronUp className="h-4 w-4 md:h-6 md:w-6" />
                    ) : (
                      <ChevronDown className="h-4 w-4 md:h-6 md:w-6" />
                    )}
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                      openSections.security
                        ? "max-h-[600px] opacity-100"
                        : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                          CURRENT PASSWORD
                        </label>
                        <Input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                          placeholder="Current password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                          NEW PASSWORD
                        </label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                          placeholder="New password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                          CONFIRM PASSWORD
                        </label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                          placeholder="Confirm password"
                        />
                      </div>
                      <p className="text-xs md:text-sm text-(--theme-text)/70">
                        Leave blank to keep your current password.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {(error || uploadError) && (
            <p className="text-sm text-red-600 font-medium shrink-0">
              {error ?? uploadError}
            </p>
          )}

          <Separator className="shrink-0 my-1 md:my-0" />

          <DialogFooter className="gap-2 md:gap-6 pt-2 md:pt-6 shrink-0 pb-1 md:pb-0">
            <FancyButton
              onClick={closeProfileModal}
              disabled={saving}
              className="flex-1 text-(--theme-text) text-xs md:text-[34px] font-bold uppercase"
            >
              CANCEL
            </FancyButton>
            <FancyButton
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-(--theme-text) text-xs md:text-[34px] font-bold uppercase"
            >
              {saving ? "SAVING…" : "SAVE"}
            </FancyButton>
          </DialogFooter>
        </FancyCard>
      </DialogContent>
    </Dialog>
  );
}
