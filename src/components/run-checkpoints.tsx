// packages/ai-ui/src/components/run-checkpoints.tsx
"use client";

import { BookmarkIcon } from "lucide-react";
import { type ComponentProps, useId } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface RunCheckpoint {
  eventId: string;
  label: string;
  description?: string;
}

export interface RunCheckpointsProps extends Omit<ComponentProps<"section">, "children"> {
  /** Checkpoints in display order. Each event id must be unique. */
  checkpoints: readonly RunCheckpoint[];
  selectedEventId?: string | null;
  onCheckpointSelect: (eventId: string) => void;
  label?: string;
}

export function RunCheckpoints({
  checkpoints, selectedEventId, onCheckpointSelect, label = "Run checkpoints", className, ...props
}: RunCheckpointsProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} data-slot="run-checkpoints" className={cn("min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground", className)} {...props}>
      <h3 id={titleId} className="text-sm font-semibold">{label}</h3>
      {checkpoints.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {checkpoints.map((checkpoint) => (
            <li key={checkpoint.eventId}>
              <button
                type="button"
                aria-pressed={selectedEventId === checkpoint.eventId}
                className={cn(
                  "flex w-full min-w-0 items-start gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-accent aria-pressed:border-primary aria-pressed:bg-accent",
                  focusRing,
                )}
                onClick={() => onCheckpointSelect(checkpoint.eventId)}
              >
                <BookmarkIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium break-words">{checkpoint.label}</span>
                  {checkpoint.description && <span className="block text-xs break-words text-muted-foreground">{checkpoint.description}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No checkpoints saved yet.</p>
      )}
    </section>
  );
}
