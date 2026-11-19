// packages/ai-ui/src/experimental/assistant-follow-up-list.tsx
"use client";

import { useId } from "react";

import { cn } from "../lib/cn.js";
import { Button } from "../components/button.js";

export interface AssistantFollowUp {
  id: string;
  title: string;
  detail?: string;
  /** Human-readable local date or time, supplied by the host. */
  due?: string;
}

export interface AssistantFollowUpListProps {
  /** Open follow-ups in the host's preferred order. */
  items: readonly AssistantFollowUp[];
  onComplete?: (id: string) => void;
  onSnooze?: (id: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function AssistantFollowUpList({
  items, onComplete, onSnooze, pendingIds = [], className,
}: AssistantFollowUpListProps) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} data-slot="assistant-follow-up-list" className={cn("min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground", className)}>
      <h3 id={heading} className="text-sm font-semibold">Follow-ups</h3>
      {items.length ? (
        <ul className="mt-2 divide-y divide-border">
          {items.map((item) => {
            const busy = pendingIds.includes(item.id);
            return (
              <li key={item.id} aria-busy={busy || undefined} className="space-y-1.5 py-2.5 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="min-w-0 text-sm font-medium break-words">{item.title}</p>
                  {item.due && <p className="text-xs text-muted-foreground">{item.due}</p>}
                </div>
                {item.detail && <p className="text-xs break-words text-muted-foreground">{item.detail}</p>}
                <div className="flex flex-wrap gap-1">
                  {onComplete && <Button type="button" size="sm" variant="outline" disabled={busy} aria-label={`Mark done: ${item.title}`} onClick={() => onComplete(item.id)}>Mark done</Button>}
                  {onSnooze && <Button type="button" size="sm" variant="ghost" disabled={busy} aria-label={`Snooze ${item.title}`} onClick={() => onSnooze(item.id)}>Snooze</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-2 text-sm text-muted-foreground">No follow-ups pending.</p>}
    </section>
  );
}
