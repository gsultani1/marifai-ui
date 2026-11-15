// packages/ai-ui/src/components/offline-queue-panel.tsx
"use client";

import { AlertTriangleIcon, CloudOffIcon, CloudUploadIcon, LoaderCircleIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";
import type { QueuedAction } from "../lib/offline-queue.js";

export interface OfflineQueuePanelProps {
  actions: QueuedAction[];
  online: boolean;
  /** Text for an action, such as "Update price of SKU 1042". Defaults to the action type. */
  describe?: (action: QueuedAction) => ReactNode;
  onRetry?: (id: string) => void;
  onDiscard?: (id: string) => void;
  onSyncNow?: () => void;
  className?: string;
}

/**
 * Outbox view for offline writes: how many changes wait to sync and why,
 * which are sending, and which are parked after repeated failures with Retry
 * and Discard. Renders nothing when the queue is empty.
 */
export function OfflineQueuePanel({ actions, online, describe = (action) => action.type, onRetry, onDiscard, onSyncNow, className }: OfflineQueuePanelProps) {
  const now = useNow(30_000, actions.length > 0);
  if (actions.length === 0) return null;
  const parked = actions.filter((action) => action.status === "parked");
  const waiting = actions.length - parked.length;
  const headline = parked.length
    ? `${parked.length} ${parked.length === 1 ? "change needs" : "changes need"} attention`
    : online
      ? `Syncing ${waiting} ${waiting === 1 ? "change" : "changes"}`
      : `${waiting} ${waiting === 1 ? "change" : "changes"} saved on this device`;

  return (
    <section aria-label="Changes waiting to sync" className={cn(card, "flex flex-col gap-2 p-3 text-sm", className)}>
      <div className="flex items-center gap-2">
        {parked.length ? <AlertTriangleIcon aria-hidden="true" className="size-4 text-destructive" /> : online ? <CloudUploadIcon aria-hidden="true" className="size-4 text-muted-foreground" /> : <CloudOffIcon aria-hidden="true" className="size-4 text-muted-foreground" />}
        <p role="status" className="flex-1 font-medium">
          {headline}
        </p>
        {onSyncNow && online && waiting > 0 && (
          <button type="button" onClick={onSyncNow} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Sync now
          </button>
        )}
      </div>
      {!online && <p className="text-xs text-muted-foreground">You're offline. Changes will send automatically when you reconnect.</p>}
      <ul className="flex flex-col divide-y divide-border">
        {actions.map((action) => {
          const text = describe(action);
          const name = typeof text === "string" ? text : action.type;
          return (
          <li key={action.id} className="flex items-center gap-2 py-1.5">
            {action.status === "sending" ? <LoaderCircleIcon aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" /> : <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", action.status === "parked" ? "bg-destructive" : "bg-muted-foreground/50")} />}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{text}</span>
              <span className={cn("text-xs", action.status === "parked" ? "font-medium text-destructive" : "text-muted-foreground")}>
                {action.status === "parked" ? `Stopped after ${action.attempts} tries: ${action.lastError ?? "couldn't sync"}` : action.status === "sending" ? "Sending" : action.attempts ? `Retrying (${action.lastError ?? "failed"})` : `Saved ${formatRelativeTime(action.createdAt, now)}`}
              </span>
            </div>
            {action.status === "parked" && onRetry && (
              <button type="button" aria-label={`Retry ${name}`} onClick={() => onRetry(action.id)} className={cn(iconButton, "size-7", focusRing)}>
                <RotateCcwIcon aria-hidden="true" />
              </button>
            )}
            {action.status === "parked" && onDiscard && (
              <button type="button" aria-label={`Discard ${name}`} onClick={() => onDiscard(action.id)} className={cn(iconButton, "size-7 hover:text-destructive", focusRing)}>
                <Trash2Icon aria-hidden="true" />
              </button>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}
