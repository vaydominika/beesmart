"use client";

import { useState } from "react";
import { Bell, Palette, Settings2, TimerReset, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
} from "@/components/ui/workspace-dialog";
import { cn } from "@/lib/utils";
import { useSettings } from "./SettingsProvider";

type SettingsSection = "appearance" | "focus" | "notifications";

const sections: Array<{ value: SettingsSection; label: string; icon: LucideIcon }> = [
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "focus", label: "Focus timer", icon: TimerReset },
  { value: "notifications", label: "Notifications", icon: Bell },
];

export function SettingsModal() {
  const {
    isModalOpen,
    closeModal,
    theme,
    setTheme,
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
    if (ok) toast.success("Settings saved");
    else toast.error("Failed to save settings. Changes saved locally.");
    closeModal();
  };

  const themes: Array<{ value: typeof theme; label: string; token: string }> = [
    { value: "bee", label: "Bee", token: "--app-theme-bee-swatch" },
    { value: "dark", label: "Moon", token: "--app-theme-dark-swatch" },
    { value: "pink", label: "Flower", token: "--app-theme-pink-swatch" },
    { value: "blue", label: "Lake", token: "--app-theme-blue-swatch" },
  ];

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <WorkspaceDialogContent className="h-[min(720px,88vh)] max-w-3xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            General settings
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>Choose how BeeSmart looks, focuses, and keeps you updated.</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2 sm:w-48 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-3">
            {sections.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setActiveSection(value)} aria-current={activeSection === value ? "page" : undefined} className={cn("flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]", activeSection === value && "bg-[var(--app-settings-active)] text-[var(--app-text)]")}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
          </nav>

          <WorkspaceDialogBody className="w-full">
            {activeSection === "appearance" ? (
              <section aria-labelledby="appearance-heading">
                <h3 id="appearance-heading" className="text-base font-semibold text-[var(--app-text)]">Appearance</h3>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Pick a theme. Every workspace and dialog updates together.</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {themes.map((option) => (
                    <button key={option.value} type="button" onClick={() => setTheme(option.value)} className={cn("flex items-center gap-3 rounded-2xl border bg-[var(--app-surface)] p-3 text-left transition-colors hover:bg-[var(--app-surface-hover)]", theme === option.value ? "border-[var(--app-focus-border)] ring-2 ring-[var(--app-focus-ring)]" : "border-[var(--app-border)]")}>
                      <span className="h-8 w-8 rounded-xl border border-[var(--app-scrim-soft)]" style={{ backgroundColor: `var(${option.token})` }} />
                      <span><span className="block text-sm font-semibold text-[var(--app-text)]">{option.label}</span><span className="block text-xs text-[var(--app-text-muted)]">{theme === option.value ? "Current theme" : "Use theme"}</span></span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {activeSection === "focus" ? (
              <section aria-labelledby="focus-settings-heading" className="space-y-5">
                <div><h3 id="focus-settings-heading" className="text-base font-semibold text-[var(--app-text)]">Focus timer</h3><p className="mt-1 text-sm text-[var(--app-text-muted)]">Set the defaults used when you open a new focus session.</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label htmlFor="default-focus-minutes" className={workspaceLabelClass}>Focus minutes</label><Input id="default-focus-minutes" type="number" min="1" max="120" value={localActiveMinutes} onChange={(event) => setLocalActiveMinutes(event.target.value)} className={workspaceFieldClass} /></div>
                  <div><label htmlFor="default-break-minutes" className={workspaceLabelClass}>Break minutes</label><Input id="default-break-minutes" type="number" min="1" max="60" value={localBreakMinutes} onChange={(event) => setLocalBreakMinutes(event.target.value)} className={workspaceFieldClass} /></div>
                </div>
                <SettingSwitch id="default-auto-break" label="Start breaks automatically" description="Begin the break as soon as a focus block ends." checked={defaultAutoBreak} onCheckedChange={setDefaultAutoBreak} />
              </section>
            ) : null}

            {activeSection === "notifications" ? (
              <section aria-labelledby="notification-settings-heading" className="space-y-3">
                <div className="mb-5"><h3 id="notification-settings-heading" className="text-base font-semibold text-[var(--app-text)]">Notifications</h3><p className="mt-1 text-sm text-[var(--app-text-muted)]">Control which updates appear in your notification center.</p></div>
                <SettingSwitch id="reminder-notifications" label="Reminders" description="Receive alerts for scheduled reminders and events." checked={reminderNotifications} onCheckedChange={setReminderNotifications} />
                <SettingSwitch id="classroom-notifications" label="Classroom updates" description="Receive activity and assignment updates from classrooms." checked={classroomNotifications} onCheckedChange={setClassroomNotifications} />
              </section>
            ) : null}
          </WorkspaceDialogBody>
        </div>

        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving…" : "Save changes"}</WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}

function SettingSwitch({ id, label, description, checked, onCheckedChange }: { id: string; label: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div><label htmlFor={id} className="text-sm font-semibold text-[var(--app-text)]">{label}</label><p className="mt-0.5 text-xs leading-4 text-[var(--app-text-muted)]">{description}</p></div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
