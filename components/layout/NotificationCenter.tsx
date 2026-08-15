"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, GraduationCap, Info, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

type Category = "GENERAL" | "CLASSROOM";
type NotificationItem = {
  id: string; title: string; body: string; category: Category; readAt?: string | null; classroomName?: string | null; actorName?: string | null; actorId?: string | null; relatedId?: string | null; relatedType?: string | null; actionUrl?: string | null; createdAt: string;
};

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>("GENERAL");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications?category=${activeTab}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
      for (const reminder of data.triggeredReminders ?? []) toast.info(`Reminder: ${reminder.task}`);
    } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);
  useEffect(() => {
    const refresh = () => void loadNotifications();
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(interval); };
  }, [loadNotifications]);

  const setRead = async (notification: NotificationItem, read = true) => {
    if (Boolean(notification.readAt) === read) return;
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notification.id, read }) });
    if (!response.ok) return;
    setItems((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: read ? new Date().toISOString() : null } : item));
    setUnreadCount((count) => Math.max(0, count + (read ? -1 : 1)));
  };

  const markAllRead = async () => {
    if (!unreadCount) return;
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true, read: true }) });
    if (!response.ok) return;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnreadCount(0);
  };

  const openNotification = async (notification: NotificationItem) => {
    await setRead(notification, true);
    if (!notification.actionUrl) return;
    setOpen(false);
    if (notification.relatedType === "event" && notification.relatedId) window.dispatchEvent(new CustomEvent("beesmart:open-event", { detail: notification.relatedId }));
    router.push(notification.actionUrl);
  };

  const formatTime = (value: string) => {
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(value).toLocaleDateString();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative rounded-md p-2 text-(--theme-text) hover:bg-[var(--app-scrim-soft)]">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--app-danger)] px-1 text-[9px] font-semibold text-[var(--app-text-inverse)]">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="notification-center z-[80] w-[min(400px,calc(100vw-16px))] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-[var(--app-text)] shadow-[var(--app-shadow-elevated)]">
        <div className="border-b border-[var(--app-border)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-[var(--app-text)]">Notifications</h3><p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</p></div><WorkspaceButton type="button" variant="ghost" size="compact" onClick={markAllRead} disabled={!unreadCount}><CheckCheck className="h-3.5 w-3.5" />Mark all read</WorkspaceButton></div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--app-surface-muted)] p-1">{(["GENERAL", "CLASSROOM"] as Category[]).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn("rounded-lg px-3 py-2 text-xs font-medium text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]", activeTab === tab && "bg-[var(--app-surface)] text-[var(--app-text)] shadow-[var(--app-shadow-soft)]")}>{tab === "GENERAL" ? "General" : "Classroom"}</button>)}</div>
        </div>
        <ScrollArea className="h-[min(440px,65vh)]">
          {loading && items.length === 0 ? <div className="flex h-44 items-center justify-center text-[var(--app-text-muted)]"><Loader2 className="h-5 w-5 animate-spin" /><span className="sr-only">Loading notifications</span></div> : items.length === 0 ? <div className="flex h-44 flex-col items-center justify-center px-8 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-surface-muted)] text-[var(--app-text-faint)]"><Bell className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[var(--app-text)]">Nothing new here</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">New updates will appear in this panel.</p></div> : <div className="p-2">{items.map((notification) => (
            <div key={notification.id} className={cn("group relative rounded-xl border border-transparent transition-colors hover:bg-[var(--app-surface-hover)]", !notification.readAt && "border-[var(--app-border)] bg-[var(--app-selection)]")}>
              <button type="button" onClick={() => void openNotification(notification)} className="flex w-full gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-focus-ring)]">
                {!notification.readAt ? <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--app-accent-text)]" /> : null}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]">{activeTab === "CLASSROOM" ? <GraduationCap className="h-4 w-4" /> : <Info className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="line-clamp-1 text-xs font-semibold text-[var(--app-text)]">{notification.title}</span><span className="shrink-0 text-[10px] text-[var(--app-text-faint)]">{formatTime(notification.createdAt)}</span></span>{notification.category === "CLASSROOM" ? <span className="mt-0.5 block text-[10px] font-medium text-[var(--app-text-faint)]">{notification.classroomName ?? "Classroom"} · {notification.actorName ?? "BeeSmart"}</span> : null}<span className="mt-1 block line-clamp-2 text-xs leading-4 text-[var(--app-text-muted)]">{notification.body}</span></span>
              </button>
              <button type="button" onClick={() => void setRead(notification, !Boolean(notification.readAt))} className="mb-2 ml-[60px] text-[10px] font-medium text-[var(--app-text-muted)] hover:text-[var(--app-text)]">{notification.readAt ? "Mark unread" : "Mark read"}</button>
            </div>
          ))}</div>}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
