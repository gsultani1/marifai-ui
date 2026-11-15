// packages/ai-ui/src/components/notification-center.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { useId, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing, iconButton, popupSurface, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";
import { usePortalContainer } from "../lib/portal.js";
import { safeUrl } from "../lib/safe-url.js";
import { SegmentedControl } from "./segmented-control.js";

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
  /** Where the notification leads; relative paths and http(s) only. */
  href?: string;
  tone?: Tone;
}

/** "99+" past 99, the number otherwise, nothing at zero. */
export function badgeCount(count: number, max = 99): string {
  return count <= 0 ? "" : count > max ? `${max}+` : String(count);
}

export interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead?: () => void;
  /** Opens a notification in place, e.g. by routing; links without it navigate normally. */
  onOpen?: (notification: AppNotification) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  className?: string;
}

/**
 * A bell with the unread count (99+ beyond that, and said in words) that
 * opens the notifications: all or unread only, each with its age and an
 * unread marker, marked read when opened, mark all read, and load more.
 * Pair it with useNotificationPolling to keep it fresh.
 */
export function NotificationCenter({ notifications, onMarkRead, onMarkAllRead, onOpen, hasMore = false, onLoadMore, loadingMore = false, open: openProp, defaultOpen = false, onOpenChange, label = "Notifications", className }: NotificationCenterProps) {
  const container = usePortalContainer();
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const now = useNow(60_000, open);
  const id = useId();
  const unread = notifications.filter((notification) => !notification.read).length;
  const shown = notifications.filter((notification) => filter === "all" || !notification.read).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={unread ? `${label}, ${unread} unread` : label} title={label} data-slot="notification-center" className={cn(iconButton, "relative", focusRing, className)}>
        <BellIcon aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-background tabular-nums">
            {badgeCount(unread)}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={6} align="end" collisionPadding={8} className="z-50">
          <Popover.Popup aria-labelledby={`${id}-title`} className={cn(popupSurface, "flex max-h-[min(32rem,var(--available-height))] w-[min(24rem,calc(100vw-1rem))] flex-col outline-none")}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <Popover.Title id={`${id}-title`} className="text-sm font-semibold">
                {label}
              </Popover.Title>
              <SegmentedControl
                label="Show"
                size="sm"
                value={filter}
                onValueChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "unread", label: `Unread (${unread})` },
                ]}
                className="ml-auto"
              />
              {onMarkAllRead && (
                <button type="button" disabled={unread === 0} onClick={onMarkAllRead} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                  <CheckCheckIcon aria-hidden="true" />
                  Mark all read
                </button>
              )}
            </div>
            <ul aria-label={filter === "unread" ? "Unread notifications" : "All notifications"} className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {shown.map((notification) => {
                const href = notification.href ? safeUrl(notification.href, ["http:", "https:"], { allowRelative: true }) : undefined;
                const age = formatRelativeTime(Math.min(notification.createdAt, now), now);
                const content = (
                  <>
                    <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.read ? "bg-transparent" : toneDot[notification.tone ?? "info"])} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("text-sm", !notification.read && "font-semibold")}>
                        {notification.title}
                        {!notification.read && <span className="sr-only">, unread</span>}
                      </span>
                      {notification.body && <span className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</span>}
                      <span className="text-xs text-muted-foreground">{age}</span>
                    </span>
                  </>
                );
                const activate = () => {
                  if (!notification.read) onMarkRead(notification.id);
                  onOpen?.(notification);
                };
                const itemClass = cn("flex w-full gap-2 px-3 py-2 text-left hover:bg-accent/50", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0");
                return (
                  <li key={notification.id} data-read={notification.read || undefined}>
                    {href && !onOpen ? (
                      <a href={href} onClick={activate} className={itemClass}>
                        {content}
                      </a>
                    ) : (
                      <button type="button" onClick={activate} className={itemClass}>
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {shown.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{filter === "unread" ? "You're all caught up." : "No notifications yet."}</p>}
            {hasMore && onLoadMore && (
              <button type="button" disabled={loadingMore} onClick={onLoadMore} className={cn("border-t border-border py-2 text-xs font-medium hover:bg-accent/50", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
