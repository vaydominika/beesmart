"use client";

import { useText } from "@/i18n/use-text";

import { LanguageSelect } from "@/components/i18n/LanguageSelect";
import { useState } from "react";
import { Bell, Palette, Settings2, TimerReset } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
} from "@/components/ui/workspace-dialog";
import { cn } from "@/lib/utils";
import { useSettings } from "./SettingsProvider";
import { SettingsSectionNav, type SettingsSectionItem } from "./SettingsSectionNav";
import { WorkspaceSwitchRow } from "@/components/ui/workspace-switch-row";

type SettingsSection = "appearance" | "focus" | "notifications";

const sections: Array<SettingsSectionItem<SettingsSection>> = [
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "focus", label: "Focus timer", icon: TimerReset },
  { value: "notifications", label: "Notifications", icon: Bell },
];

export function SettingsModal() {
  const t = useText();
  const {
    isModalOpen,
    closeModal,
    theme,
    setTheme,
    setLocale,
    defaultActiveMinutes,
    defaultBreakMinutes,
    defaultAutoBreak,
    setDefaultActiveMinutes,
    setDefaultBreakMinutes,
    setDefaultAutoBreak,
    reminderNotifications,
    classroomNotifications,
    setReminderNotifications,
    setClassroomNotifications,
    saveSettingsToServer,
    isSaving,
  } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");
  const [localActiveMinutes, setLocalActiveMinutes] = useState(String(defaultActiveMinutes));
  const [localBreakMinutes, setLocalBreakMinutes] = useState(String(defaultBreakMinutes));

  const handleSave = async () => {
    const active = Math.min(120, Math.max(1, Number.parseInt(localActiveMinutes, 10) || 45));
    const breakMins = Math.min(60, Math.max(1, Number.parseInt(localBreakMinutes, 10) || 15));
    setDefaultActiveMinutes(active);
    setDefaultBreakMinutes(breakMins);
    const ok = await saveSettingsToServer({ defaultActiveMinutes: active, defaultBreakMinutes: breakMins });
    if (ok) toast.success(t("Settings saved"));
    else toast.error(t("Failed to save settings. Changes saved locally."));
    closeModal();
  };

  const themes: Array<{ value: typeof theme; label: string; token: string }> = [
    { value: "bee", label: t("Bee"), token: "--app-theme-bee-swatch" },
    { value: "dark", label: t("Moon"), token: "--app-theme-dark-swatch" },
    { value: "pink", label: t("Flower"), token: "--app-theme-pink-swatch" },
    { value: "blue", label: t("Lake"), token: "--app-theme-blue-swatch" },
  ];

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <WorkspaceDialogContent className="h-[min(720px,88vh)] max-w-3xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
             {t("General settings")} </WorkspaceDialogTitle>
        </WorkspaceDialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <SettingsSectionNav ariaLabel={t("Settings sections")} items={sections} value={activeSection} onValueChange={setActiveSection} />

          <WorkspaceDialogBody className="w-full">
            {activeSection === "appearance" ? (
              <section aria-labelledby="appearance-heading">
                <h3 id="appearance-heading" className="text-base font-semibold text-[var(--app-text)]">{t("Appearance")}</h3>
                <div className="mt-4"><LanguageSelect onChange={setLocale} /></div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {themes.map((option) => (
                    <button key={option.value} type="button" aria-pressed={theme === option.value} onClick={() => setTheme(option.value)} className={cn("flex items-center gap-3 rounded-2xl border bg-[var(--app-surface)] p-3 text-left transition-colors hover:bg-[var(--app-surface-hover)]", theme === option.value ? "border-[var(--app-focus-border)] ring-2 ring-[var(--app-focus-ring)]" : "border-[var(--app-border)]")}>
                      <span className="h-8 w-8 rounded-xl border border-[var(--app-scrim-soft)]" style={{ backgroundColor: `var(${option.token})` }} />
                      <span className="text-sm font-semibold text-[var(--app-text)]">{t(option.label)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {activeSection === "focus" ? (
              <section aria-labelledby="focus-settings-heading" className="space-y-5">
                <h3 id="focus-settings-heading" className="text-base font-semibold text-[var(--app-text)]">{t("Focus timer")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label htmlFor="default-focus-minutes" className={workspaceLabelClass}>{t("Focus minutes")}</label><Input id="default-focus-minutes" type="number" min="1" max="120" value={localActiveMinutes} onChange={(event) => setLocalActiveMinutes(event.target.value)} className={workspaceFieldClass} /></div>
                  <div><label htmlFor="default-break-minutes" className={workspaceLabelClass}>{t("Break minutes")}</label><Input id="default-break-minutes" type="number" min="1" max="60" value={localBreakMinutes} onChange={(event) => setLocalBreakMinutes(event.target.value)} className={workspaceFieldClass} /></div>
                </div>
                <WorkspaceSwitchRow id="default-auto-break" label={t("Start breaks automatically")} checked={defaultAutoBreak} onCheckedChange={setDefaultAutoBreak} />
              </section>
            ) : null}

            {activeSection === "notifications" ? (
              <section aria-labelledby="notification-settings-heading" className="space-y-3">
                <h3 id="notification-settings-heading" className="text-base font-semibold text-[var(--app-text)]">{t("Notifications")}</h3>
                <WorkspaceSwitchRow id="reminder-notifications" label={t("Reminders")} checked={reminderNotifications} onCheckedChange={setReminderNotifications} />
                <WorkspaceSwitchRow id="classroom-notifications" label={t("Classroom updates")} checked={classroomNotifications} onCheckedChange={setClassroomNotifications} />
              </section>
            ) : null}
          </WorkspaceDialogBody>
        </div>

        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>{t("Cancel")}</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={handleSave} disabled={isSaving}>{isSaving ? t("Saving…") : t("Save changes")}</WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
