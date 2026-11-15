// packages/ai-ui/src/components/delivery-status.tsx
"use client";

import { CheckCheckIcon, CheckIcon, ClockIcon, CloudOffIcon, LoaderCircleIcon, MailXIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useNow } from "../hooks/use-now.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { toDate } from "../lib/dates.js";
import { formatRelativeTime } from "../lib/format.js";

export type DeliveryState = "queued" | "sending" | "sent" | "accepted" | "delivered" | "read" | "working" | "retrying" | "delayed" | "failed" | "bounced" | "unavailable";

interface DeliveryMeta {
  label: string;
  icon: ReactNode;
  /** Problems the sender must act on. */
  attention?: boolean;
  className?: string;
}

const spin = "motion-safe:animate-spin";

export const DELIVERY_STATES: Record<DeliveryState, DeliveryMeta> = {
  queued: { label: "Queued", icon: <ClockIcon aria-hidden="true" /> },
  sending: { label: "Sending", icon: <LoaderCircleIcon aria-hidden="true" className={spin} /> },
  sent: { label: "Sent", icon: <CheckIcon aria-hidden="true" /> },
  accepted: { label: "Accepted", icon: <CheckIcon aria-hidden="true" /> },
  delivered: { label: "Delivered", icon: <CheckCheckIcon aria-hidden="true" /> },
  read: { label: "Read", icon: <CheckCheckIcon aria-hidden="true" className="text-ring" /> },
  working: { label: "Working on it", icon: <LoaderCircleIcon aria-hidden="true" className={spin} /> },
  retrying: { label: "Retrying", icon: <RefreshCwIcon aria-hidden="true" className={spin} /> },
  delayed: { label: "Delayed", icon: <ClockIcon aria-hidden="true" className="text-warning" /> },
  failed: { label: "Not sent", icon: <TriangleAlertIcon aria-hidden="true" />, attention: true, className: "text-destructive" },
  bounced: { label: "Bounced", icon: <MailXIcon aria-hidden="true" />, attention: true, className: "text-destructive" },
  unavailable: { label: "Recipient unavailable", icon: <CloudOffIcon aria-hidden="true" />, attention: true, className: "text-destructive" },
};

export interface DeliveryStatusProps extends Omit<ComponentProps<"span">, "children"> {
  state: DeliveryState;
  /** When the state last changed; shown as relative time. */
  at?: Date | string | number;
  /** The status hasn't been confirmed recently (for example while offline). */
  stale?: boolean;
  /** Why it failed or is delayed. */
  detail?: string;
  onRetry?: () => void;
  /** Icon only, with the label kept for assistive technology. */
  compact?: boolean;
  /** Announces changes politely; use on the latest message only. */
  live?: boolean;
  locale?: string;
}

/** Per-message delivery receipt: queued through read, plus retry for failures. */
export function DeliveryStatus({ state, at, stale = false, detail, onRetry, compact = false, live = false, locale, className, ...props }: DeliveryStatusProps) {
  const now = useNow(30_000, at !== undefined);
  const meta = DELIVERY_STATES[state];
  const time = at === undefined ? undefined : formatRelativeTime(toDate(at), now, locale);
  const text = [meta.label, stale ? "may be out of date" : undefined, detail].filter(Boolean).join(", ");

  return (
    <span
      role={live ? "status" : undefined}
      data-slot="delivery-status"
      data-state={state}
      title={compact ? [text, time].filter(Boolean).join(" · ") : detail}
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0", meta.className, stale && "italic", className)}
      {...props}
    >
      {meta.icon}
      <span className={compact ? "sr-only" : undefined}>{text}</span>
      {time && !compact && (
        <time dateTime={toDate(at!).toISOString()} className="text-muted-foreground">
          · {time}
        </time>
      )}
      {meta.attention && onRetry && (
        <button type="button" onClick={onRetry} className={cn("ml-1 rounded-sm font-medium text-foreground underline underline-offset-2 hover:no-underline", focusRing)}>
          Retry
        </button>
      )}
    </span>
  );
}
