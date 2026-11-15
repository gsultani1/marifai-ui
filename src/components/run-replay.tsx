// packages/ai-ui/src/components/run-replay.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon, RadioIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";

export interface RunReplayEvent {
  id: string;
  label: string;
  kind: string;
  detail?: ReactNode;
}

export interface RunReplayProps extends Omit<ComponentProps<"section">, "children"> {
  /** Events in display order, from oldest to newest. Each id must be unique. */
  events: readonly RunReplayEvent[];
  /** null follows the latest event as more events arrive. */
  eventId: string | null;
  onEventChange: (id: string | null) => void;
  label?: string;
}

export function RunReplay({ events, eventId, onEventChange, label = "Run replay", className, ...props }: RunReplayProps) {
  const titleId = useId();
  const sliderId = useId();
  const latestIndex = events.length - 1;
  const index = eventId === null ? latestIndex : events.findIndex((event) => event.id === eventId);
  const active = events[index];
  const select = (position: number) => {
    const event = events[position];
    if (event) onEventChange(event.id);
  };

  return (
    <section aria-labelledby={titleId} data-slot="run-replay" className={cn("min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground", className)} {...props}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="text-sm font-semibold">{label}</h3>
        {events.length > 0 && (
          <Button size="sm" variant="outline" disabled={eventId === null} onClick={() => onEventChange(null)}>
            <RadioIcon aria-hidden="true" />
            {eventId === null ? "Following latest" : "Follow latest"}
          </Button>
        )}
      </header>
      {active ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" aria-label="Previous event" disabled={index === 0} onClick={() => select(index - 1)}>
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <label htmlFor={sliderId} className="sr-only">Replay position</label>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={latestIndex}
              value={index}
              disabled={latestIndex === 0}
              aria-valuetext={`Event ${index + 1} of ${events.length}, ${active.label}`}
              className={cn("min-w-0 flex-1 cursor-pointer rounded accent-primary", focusRing)}
              onChange={(event) => select(event.currentTarget.valueAsNumber)}
            />
            <Button size="sm" variant="outline" aria-label="Next event" disabled={index === latestIndex} onClick={() => select(index + 1)}>
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
          <div aria-live="polite" aria-atomic="true" className="mt-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span className="tabular-nums">Event {index + 1} of {events.length}</span>
              <span>{active.kind}</span>
            </div>
            <p className="mt-1 text-sm font-medium break-words">{active.label}</p>
            {active.detail != null && <div className="mt-1 text-sm break-words text-muted-foreground">{active.detail}</div>}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{events.length ? "This event is no longer available." : "No run events yet."}</p>
      )}
    </section>
  );
}
