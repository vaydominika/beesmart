import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthenticatedApp } from "@/components/layout/AuthenticatedApp";
import { FocusProvider } from "@/components/focus/FocusProvider";
import { LayoutProvider } from "@/components/layout/LayoutProvider";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { DashboardProvider } from "@/lib/DashboardContext";

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
    return null;
  }

  return (
    <AuthenticatedApp>
      <SettingsProvider>
        <DashboardProvider>
          <FocusProvider>
            <LayoutProvider>
              <AppLayout>{children}</AppLayout>
            </LayoutProvider>
          </FocusProvider>
        </DashboardProvider>
      </SettingsProvider>
    </AuthenticatedApp>
  );
}
