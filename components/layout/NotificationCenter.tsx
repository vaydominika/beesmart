"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, GraduationCap, Info, Loader2 } from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Category = "GENERAL" | "CLASSROOM";
type NotificationItem = {
    id: string;
    title: string;
    body: string;
    category: Category;
    readAt?: string | null;
    classroomName?: string | null;
    actorName?: string | null;
    actionUrl?: string | null;
    createdAt: string;
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
            const res = await fetch(`/api/notifications?category=${activeTab}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setItems(data.notifications);
            setUnreadCount(data.unreadCount);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    useEffect(() => {
        const refresh = () => loadNotifications();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [loadNotifications]);

    const setRead = async (notification: NotificationItem, read = true) => {
        if (Boolean(notification.readAt) === read) return;
        const res = await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: notification.id, read }),
        });
        if (!res.ok) return;
        setItems((current) => current.map((item) => item.id === notification.id
            ? { ...item, readAt: read ? new Date().toISOString() : null }
            : item));
        setUnreadCount((count) => Math.max(0, count + (read ? -1 : 1)));
    };

    const markAllRead = async () => {
        if (!unreadCount) return;
        const res = await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true, read: true }),
        });
        if (!res.ok) return;
        const now = new Date().toISOString();
        setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
        setUnreadCount(0);
    };

    const openNotification = async (notification: NotificationItem) => {
        await setRead(notification, true);
        if (notification.actionUrl) {
            setOpen(false);
            router.push(notification.actionUrl);
        }
    };

    const formatTime = (value: string) => {
        const date = new Date(value);
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return "Just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                    className="relative p-2 rounded-md hover:bg-black/10 text-(--theme-text) outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0 bg-(--theme-bg) border-(--theme-text)/10 shadow-2xl rounded-2xl corner-squircle overflow-hidden">
                <div className="p-4 pb-3 border-b border-(--theme-text)/10">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold uppercase text-(--theme-text)">Notifications</h3>
                        <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] font-bold uppercase text-(--theme-text) opacity-55 hover:opacity-100">
                            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 bg-(--theme-sidebar) p-1 rounded-xl">
                        {(["GENERAL", "CLASSROOM"] as Category[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "rounded-lg py-2 text-[11px] font-bold uppercase transition-colors",
                                    activeTab === tab ? "bg-(--theme-card) text-(--theme-text)" : "text-(--theme-text) opacity-45 hover:opacity-80",
                                )}
                            >
                                {tab === "GENERAL" ? "General" : "Classroom"}
                            </button>
                        ))}
                    </div>
                </div>
                <ScrollArea className="h-[420px]">
                    {loading && items.length === 0 ? (
                        <div className="h-40 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin opacity-50" /></div>
                    ) : items.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center px-8 text-(--theme-text)">
                            <Bell className="h-7 w-7 opacity-20 mb-2" />
                            <p className="text-xs font-bold uppercase opacity-45">Nothing new here</p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {items.map((notification) => (
                                <button
                                    key={notification.id}
                                    onClick={() => openNotification(notification)}
                                    className={cn(
                                        "w-full text-left flex gap-3 p-3 rounded-xl transition-colors relative",
                                        notification.readAt ? "opacity-55 hover:bg-(--theme-sidebar)" : "bg-(--theme-card)/35 hover:bg-(--theme-card)/55",
                                    )}
                                >
                                    {!notification.readAt && <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                    <div className="w-8 h-8 shrink-0 rounded-lg bg-(--theme-sidebar) flex items-center justify-center text-(--theme-text)">
                                        {activeTab === "CLASSROOM" ? <GraduationCap className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between gap-2">
                                            <p className="text-xs font-bold text-(--theme-text) line-clamp-1">{notification.title}</p>
                                            <span className="text-[9px] text-(--theme-text) opacity-45 shrink-0">{formatTime(notification.createdAt)}</span>
                                        </div>
                                        {notification.category === "CLASSROOM" && (
                                            <p className="text-[10px] font-bold uppercase text-(--theme-text) opacity-45 mt-0.5">
                                                {notification.classroomName ?? "Classroom"} · {notification.actorName ?? "BeeSmart"}
                                            </p>
                                        )}
                                        <p className="text-[11px] text-(--theme-text) opacity-65 mt-1 line-clamp-2">{notification.body}</p>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => { event.stopPropagation(); setRead(notification, !Boolean(notification.readAt)); }}
                                            onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); setRead(notification, !Boolean(notification.readAt)); } }}
                                            className="inline-block mt-1.5 text-[9px] font-bold uppercase text-(--theme-text) opacity-45 hover:opacity-100"
                                        >
                                            {notification.readAt ? "Mark unread" : "Mark read"}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
