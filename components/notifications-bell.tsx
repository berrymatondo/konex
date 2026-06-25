"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n/language-context";

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function timeAgo(iso: string, fr: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return fr ? "À l'instant" : "Just now";
  if (mins < 60) return `${mins} ${fr ? "min" : "min"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${fr ? "h" : "h"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${fr ? "j" : "d"}`;
}

export function NotificationsBell() {
  const { language, t } = useLanguage();
  const fr = language === "fr";
  const router = useRouter();

  // Poll every 30s so a counterparty sees new notifications without reloading.
  const { data, mutate } = useSWR<NotificationsResponse>("/api/notifications", fetcher, {
    refreshInterval: 30000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    mutate();
  };

  const handleClick = async (n: NotificationItem) => {
    if (!n.read) {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
      mutate();
    }
    if (n.link) router.push(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">{t.header.notifications}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">
            {fr ? "Notifications" : "Notifications"}
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={markAllRead}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              {fr ? "Tout marquer lu" : "Mark all read"}
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {fr ? "Aucune notification" : "No notifications"}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {!n.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-hidden />
                        )}
                        {n.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(n.createdAt, fr)}
                      </span>
                    </div>
                    {n.message && (
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {n.message}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
