// packages/ai-ui/src/components/status-pill.tsx
"use client";

import { CloudIcon, CloudOffIcon, LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useNow } from "../hooks/use-now.js";
import { focusRing, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";

export interface StatusPillProps extends ComponentProps<"span"> {
  tone?: Tone;
  /** Pulses the dot, e.g. while generating. Still under reduced motion. */
  pulse?: boolean;
  /** Announces changes politely. Leave off for decorative pills. */
  live?: boolean;
}

/** Compact dot-and-label status, e.g. "Generating" or "Editing app.tsx". */
export function StatusPill({ tone = "neutral", pulse = false, live = false, className, children, ...props }: StatusPillProps) {
  return (
    <span
      role={live ? "status" : undefined}
      data-slot="status-pill"
      data-tone={tone}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="relative flex size-2 shrink-0">
        {pulse && <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", toneDot[tone])} />}
        <span className={cn("relative size-2 rounded-full", toneDot[tone])} />
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

export type SyncState = "synced" | "syncing" | "offline" | "error";

export interface SyncStatusProps extends Omit<ComponentProps<"div">, "children"> {
  state: SyncState;
  lastSyncedAt?: Date | number | undefined;
  /** Items waiting to sync. */
  pending?: number;
  /** Items that keep failing and need attention. */
  stuck?: number;
  onSync?: () => void;
  /** Overrides the generated label. */
  label?: ReactNode;
}

const SYNC_ICONS: Record<SyncState, ReactNode> = {
  synced: <CloudIcon aria-hidden="true" />,
  syncing: <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />,
  offline: <CloudOffIcon aria-hidden="true" />,
  error: <TriangleAlertIcon aria-hidden="true" className="text-destructive" />,
};

/** "Synced 5 minutes ago", "3 queued (1 stuck)" or "Offline", with a Sync now button. */
export function SyncStatus({ state, lastSyncedAt, pending = 0, stuck = 0, onSync, label, className, ...props }: SyncStatusProps) {
  const now = useNow(30_000, lastSyncedAt !== undefined);
  const parts: string[] = [];
  if (state === "syncing") parts.push("Syncing");
  if (state === "offline") parts.push("Offline");
  if (state === "error") parts.push("Sync failed");
  if (pending > 0) parts.push(`${pending} queued${stuck > 0 ? ` (${stuck} stuck)` : ""}`);
  if (state === "synced" && pending === 0) {
    parts.push(lastSyncedAt !== undefined ? `Synced ${formatRelativeTime(lastSyncedAt, Math.max(now, new Date(lastSyncedAt).getTime()))}` : "Synced");
  } else if (lastSyncedAt !== undefined && state !== "syncing") {
    parts.push(`last synced ${formatRelativeTime(lastSyncedAt, Math.max(now, new Date(lastSyncedAt).getTime()))}`);
  }

  return (
    <div
      role="status"
      data-slot="sync-status"
      data-state={state}
      className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5", className)}
      {...props}
    >
      {SYNC_ICONS[state]}
      <span>{label ?? parts.join(" · ")}</span>
      {onSync && state !== "syncing" && (
        <button
          type="button"
          onClick={onSync}
          className={cn("inline-flex items-center gap-1 rounded-sm font-medium text-foreground hover:underline", focusRing)}
        >
          <RefreshCwIcon aria-hidden="true" />
          {state === "error" ? "Retry" : "Sync now"}
        </button>
      )}
    </div>
  );
}
