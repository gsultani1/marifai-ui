// packages/ai-ui/src/components/thread-markers.tsx
"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronUpIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { useNow } from "../hooks/use-now.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDayLabel } from "../lib/conversation.js";
import { toDate } from "../lib/dates.js";
import { ConversationMarker } from "./conversation-marker.js";

export interface DateSeparatorProps extends Omit<ComponentProps<"div">, "children"> {
  date: Date | string | number;
  locale?: string;
}

/** Day divider in a thread: "Today", "Yesterday", a weekday or a full date. */
export function DateSeparator({ date, locale, ...props }: DateSeparatorProps) {
  const now = useNow(60_000);
  const value = toDate(date);
  return (
    <ConversationMarker data-slot="date-separator" {...props}>
      <time dateTime={value.toISOString()} className="font-medium">
        {formatDayLabel(value, now, locale)}
      </time>
    </ConversationMarker>
  );
}

/** Marks where unread messages begin. */
export function NewMessagesDivider({ className, children = "New messages", ...props }: ComponentProps<"div">) {
  return (
    <ConversationMarker data-slot="new-messages-divider" className={cn("font-medium text-foreground [&>span[aria-hidden]]:bg-destructive/60", className)} {...props}>
      {children}
    </ConversationMarker>
  );
}

export interface EarlierMessagesProps {
  /** Messages not yet shown; pair with useMessageWindow. */
  hiddenCount: number;
  onShow: () => void;
  /** Messages revealed per click, for the label. */
  step?: number;
  /** Earlier history is being fetched from the server. */
  loading?: boolean;
  className?: string;
}

/** "Show earlier messages" control at the top of a long thread. */
export function EarlierMessages({ hiddenCount, onShow, step, loading = false, className }: EarlierMessagesProps) {
  if (hiddenCount <= 0 && !loading) return null;
  const next = step ? Math.min(step, hiddenCount) : hiddenCount;
  return (
    <div data-slot="earlier-messages" className={cn("flex justify-center", className)}>
      <button
        type="button"
        onClick={onShow}
        disabled={loading}
        className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent disabled:opacity-60 [&_svg]:size-3.5", focusRing)}
      >
        {loading ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <ChevronUpIcon aria-hidden="true" />}
        {loading ? "Loading earlier messages" : `Show ${next === hiddenCount ? "" : `${next} of `}${hiddenCount} earlier ${hiddenCount === 1 ? "message" : "messages"}`}
      </button>
    </div>
  );
}

export interface UnreadJumpProps {
  count: number;
  /** "down" for new messages below the viewport, "up" for unread history above it. */
  direction?: "down" | "up";
  onJump: () => void;
  /** Adds a "Mark as read" button. */
  onDismiss?: () => void;
  className?: string;
}

/** Floating pill that jumps to unread messages, such as "3 new messages" while scrolled up. */
export function UnreadJump({ count, direction = "down", onJump, onDismiss, className }: UnreadJumpProps) {
  const label = direction === "down" ? `${count} new ${count === 1 ? "message" : "messages"}` : `${count} unread ${count === 1 ? "message" : "messages"}`;
  return (
    <div aria-live="polite" data-slot="unread-jump" className={cn("pointer-events-none flex justify-center", className)}>
      {count > 0 && (
        <div className="pointer-events-auto inline-flex items-center rounded-full bg-primary text-primary-foreground shadow-md">
          <button type="button" onClick={onJump} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full pr-2 pl-3 text-xs font-medium hover:opacity-90 [&_svg]:size-3.5", !onDismiss && "pr-3", focusRing)}>
            {direction === "down" ? <ArrowDownIcon aria-hidden="true" /> : <ArrowUpIcon aria-hidden="true" />}
            {label}
          </button>
          {onDismiss && (
            <button type="button" aria-label="Mark as read" title="Mark as read" onClick={onDismiss} className={cn("mr-1 inline-flex size-6 items-center justify-center rounded-full hover:bg-primary-foreground/15 [&_svg]:size-3.5", focusRing)}>
              <XIcon aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
