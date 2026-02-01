"use client";

import { useState } from "react";
import { FancyCard } from '../fancycard'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Settings01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { FancyButton } from '../fancybutton'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { useSettings } from './SettingsProvider'
import { ScrollArea } from '../ui/scroll-area'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from "@/components/ui/separator"

export function SettingsModal() {
  const {
    isModalOpen,
    closeModal,
    userName,
    userRole,
    setUserName,
    setUserRole,
    theme,
    setTheme,
    defaultActiveMinutes,
    defaultBreakMinutes,
    defaultAutoBreak,
    setDefaultActiveMinutes,
    setDefaultBreakMinutes,
    setDefaultAutoBreak,
    emailNotifications,
    reminderNotifications,
    courseAlerts,
    setEmailNotifications,
    setReminderNotifications,
    setCourseAlerts,
    profileVisibility,
    activitySharing,
    setProfileVisibility,
    setActivitySharing,
  } = useSettings();

  const [localName, setLocalName] = useState(userName);
  const [localRole, setLocalRole] = useState(userRole);
  const [localActiveMinutes, setLocalActiveMinutes] = useState(defaultActiveMinutes.toString());
  const [localBreakMinutes, setLocalBreakMinutes] = useState(defaultBreakMinutes.toString());
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Section open/close state - all closed by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: false,
    theme: false,
    focusTimer: false,
    security: false,
    notifications: false,
    privacy: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSave = () => {
    setUserName(localName);
    setUserRole(localRole);
    const active = parseInt(localActiveMinutes) || 45;
    const breakMins = parseInt(localBreakMinutes) || 15;
    setDefaultActiveMinutes(active);
    setDefaultBreakMinutes(breakMins);
    
    // Handle password change if all fields are filled
    if (currentPassword && newPassword && confirmPassword) {
      if (newPassword === confirmPassword) {
        // In a real app, you'd send this to your backend
        console.log("Password change requested");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert("New passwords don't match!");
        return;
      }
    }
    
    closeModal();
  };

  const themes: { value: typeof theme; label: string; color: string }[] = [
    { value: "bee", label: "BEE", color: "#FADA6D" },
    { value: "dark", label: "DARK", color: "#4A5568" },
    { value: "ocean", label: "OCEAN", color: "#4FD1C7" },
    { value: "forest", label: "FOREST", color: "#68D391" },
  ];

  return (
    <Dialog open={isModalOpen} onOpenChange={closeModal}>
      <DialogContent className="p-0 max-w-2xl border-0 bg-transparent shadow-none">
        <FancyCard className="bg-(--theme-bg) p-10 flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-[40px] font-bold text-(--theme-text) uppercase">
              <HugeiconsIcon icon={Settings01Icon} size={48} strokeWidth={2.2}/>
              SETTINGS
            </DialogTitle>
          </DialogHeader>
          
          <div className="my-8">
            <ScrollArea className="h-[65vh] pr-2">
              <div className="space-y-8 px-2 pb-4">
              {/* Profile Section */}
              <div>
                <button
                  onClick={() => toggleSection('profile')}
                  className="w-full flex items-center justify-between text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                >
                  <span>PROFILE</span>
                  {openSections.profile ? (
                    <ChevronUp className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                    openSections.profile ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        NAME
                      </label>
                      <Input
                        type="text"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[28px] font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-16 w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        ROLE
                      </label>
                      <Input
                        type="text"
                        value={localRole}
                        onChange={(e) => setLocalRole(e.target.value)}
                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[28px] font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-16 w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Section */}
              <div>
                <button
                  onClick={() => toggleSection('theme')}
                  className="w-full flex items-center justify-between text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                >
                  <span>THEME</span>
                  {openSections.theme ? (
                    <ChevronUp className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                    openSections.theme ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    {themes.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTheme(t.value)}
                        className={`p-4 rounded-xl corner-squircle border-2 transition-all ${
                          theme === t.value
                            ? "border-(--theme-text-important) bg-(--theme-sidebar)"
                            : "border-transparent bg-(--theme-sidebar)/50 hover:bg-(--theme-sidebar)/70"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="text-[22px] font-bold text-(--theme-text) uppercase">
                            {t.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Focus Timer Defaults */}
              <div>
                <button
                  onClick={() => toggleSection('focusTimer')}
                  className="w-full flex items-center justify-between text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                >
                  <span>FOCUS TIMER</span>
                  {openSections.focusTimer ? (
                    <ChevronUp className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                    openSections.focusTimer ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        ACTIVE MINUTES
                      </label>
                      <Input
                        type="number"
                        value={localActiveMinutes}
                        onChange={(e) => setLocalActiveMinutes(e.target.value)}
                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[36px] font-bold text-center border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) w-40 h-20"
                        min="1"
                        max="120"
                      />
                    </div>
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        BREAK MINUTES
                      </label>
                      <Input
                        type="number"
                        value={localBreakMinutes}
                        onChange={(e) => setLocalBreakMinutes(e.target.value)}
                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[36px] font-bold text-center border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) w-40 h-20"
                        min="1"
                        max="60"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <label className="text-[22px] font-bold text-(--theme-text) uppercase">
                        AUTO BREAK
                      </label>
                      <Switch
                        checked={defaultAutoBreak}
                        onCheckedChange={setDefaultAutoBreak}
                        className="data-[state=checked]:bg-(--theme-sidebar) scale-125"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div>
                <button
                  onClick={() => toggleSection('security')}
                  className="w-full flex items-center justify-between text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                >
                  <span>SECURITY</span>
                  {openSections.security ? (
                    <ChevronUp className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                    openSections.security ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        CURRENT PASSWORD
                      </label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[28px] font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-16 w-full"
                        placeholder="Current password"
                      />
                    </div>
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        NEW PASSWORD
                      </label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[28px] font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-16 w-full"
                        placeholder="New password"
                      />
                    </div>
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        CONFIRM PASSWORD
                      </label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-(--theme-sidebar) rounded-xl corner-squircle text-[28px] font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-16 w-full"
                        placeholder="Confirm password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div>
                <button
                  onClick={() => toggleSection('notifications')}
                  className="w-full flex items-center justify-between text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                >
                  <span>NOTIFICATIONS</span>
                  {openSections.notifications ? (
                    <ChevronUp className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                    openSections.notifications ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[22px] font-bold text-(--theme-text) uppercase">
                        EMAIL
                      </label>
                      <Switch
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                        className="data-[state=checked]:bg-(--theme-sidebar) scale-125"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-[22px] font-bold text-(--theme-text) uppercase">
                        REMINDERS
                      </label>
                      <Switch
                        checked={reminderNotifications}
                        onCheckedChange={setReminderNotifications}
                        className="data-[state=checked]:bg-(--theme-sidebar) scale-125"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-[22px] font-bold text-(--theme-text) uppercase">
                        COURSE ALERTS
                      </label>
                      <Switch
                        checked={courseAlerts}
                        onCheckedChange={setCourseAlerts}
                        className="data-[state=checked]:bg-(--theme-sidebar) scale-125"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div>
                <button
                  onClick={() => toggleSection('privacy')}
                  className="w-full flex items-center justify-between text-[28px] font-bold text-(--theme-text) uppercase mb-4 hover:text-(--theme-text-important) transition-colors"
                >
                  <span>PRIVACY</span>
                  {openSections.privacy ? (
                    <ChevronUp className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden pb-2 transition-all duration-300 ease-in-out px-2",
                    openSections.privacy ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                        PROFILE VISIBILITY
                      </label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setProfileVisibility("public")}
                          className={`flex-1 p-4 rounded-xl corner-squircle border-2 transition-all ${
                            profileVisibility === "public"
                              ? "border-(--theme-text-important) bg-(--theme-sidebar)"
                              : "border-transparent bg-(--theme-sidebar)/50 hover:bg-(--theme-sidebar)/70"
                          }`}
                        >
                          <span className="text-[22px] font-bold text-(--theme-text) uppercase">
                            PUBLIC
                          </span>
                        </button>
                        <button
                          onClick={() => setProfileVisibility("private")}
                          className={`flex-1 p-4 rounded-xl corner-squircle border-2 transition-all ${
                            profileVisibility === "private"
                              ? "border-(--theme-text-important) bg-(--theme-sidebar)"
                              : "border-transparent bg-(--theme-sidebar)/50 hover:bg-(--theme-sidebar)/70"
                          }`}
                        >
                          <span className="text-[22px] font-bold text-(--theme-text) uppercase">
                            PRIVATE
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <label className="text-[22px] font-bold text-(--theme-text) uppercase">
                        ACTIVITY SHARING
                      </label>
                      <Switch
                        checked={activitySharing}
                        onCheckedChange={setActivitySharing}
                        className="data-[state=checked]:bg-(--theme-sidebar) scale-125"
                      />
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </ScrollArea>
          </div>

          <Separator />

          <DialogFooter className="gap-6 pt-6">
            <FancyButton
              onClick={closeModal}
              className="flex-1 text-(--theme-text) text-[28px] font-bold uppercase"
            >
              CANCEL
            </FancyButton>
            <FancyButton
              onClick={handleSave}
              className="flex-1 text-(--theme-text) text-[28px] font-bold uppercase"
            >
              SAVE
            </FancyButton>
          </DialogFooter> 
        </FancyCard>
      </DialogContent>
    </Dialog>
  )
}