import { AppLayout } from "@/components/layout/AppLayout";
import { FocusProvider } from "@/components/focus/FocusProvider";
import { LayoutProvider } from "@/components/layout/LayoutProvider";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { DashboardProvider } from "@/lib/DashboardContext";

export default function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SettingsProvider>
      <DashboardProvider>
        <FocusProvider>
          <LayoutProvider>
            <AppLayout>{children}</AppLayout>
          </LayoutProvider>
        </FocusProvider>
      </DashboardProvider>
    </SettingsProvider>
  );
}
