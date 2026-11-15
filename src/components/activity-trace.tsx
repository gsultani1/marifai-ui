// packages/ai-ui/src/components/activity-trace.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { BrainIcon, ChevronDownIcon, FlagIcon, StickyNoteIcon, Trash2Icon, WrenchIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import { collapsibleChevron, collapsiblePanel, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDuration } from "../lib/format.js";
import { type StepStatus, StepStatusIcon } from "../lib/step-status.js";

export type ActivityKind = "reasoning" | "tool" | "stage" | "note";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: ReactNode;
  detail?: ReactNode;
  status?: StepStatus;
  durationMs?: number;
}

const KIND_ICONS: Record<ActivityKind, ReactNode> = {
  reasoning: <BrainIcon aria-hidden="true" />,
  tool: <WrenchIcon aria-hidden="true" />,
  stage: <FlagIcon aria-hidden="true" />,
  note: <StickyNoteIcon aria-hidden="true" />,
};

export interface ActivityTraceProps extends Omit<ComponentProps<"section">, "children"> {
  events: ActivityEvent[];
  /** Opens the trace and announces the latest event while true. */
  running?: boolean;
  /** Newest events kept on screen; older ones collapse into a count. */
  maxEvents?: number;
  onClear?: () => void;
  label?: string;
}

/**
 * One timeline for everything an agent did: reasoning summaries, tool calls,
 * orchestrator stages and notes. Open while the run is active, collapsed
 * afterwards unless the user opened it.
 */
export function ActivityTrace({ events, running = false, maxEvents = 80, onClear, label = "Activity", className, ...props }: ActivityTraceProps) {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? running;
  const hidden = Math.max(0, events.length - maxEvents);
  const shown = hidden > 0 ? events.slice(hidden) : events;
  const latest = events.at(-1);

  return (
    <section aria-label={label} data-slot="activity-trace" className={cn("rounded-lg border border-border bg-card text-sm text-card-foreground", className)} {...props}>
      <Collapsible.Root open={open} onOpenChange={(next) => setToggled(next)}>
        <div className="flex items-center gap-1 pr-1.5">
          <Collapsible.Trigger className={cn("group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left", focusRing)}>
            <span className="font-medium">{label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {events.length} event{events.length === 1 ? "" : "s"}
            </span>
            {running && latest && (
              <span role="status" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {latest.title}
              </span>
            )}
            <ChevronDownIcon aria-hidden="true" className={cn(collapsibleChevron, "ml-auto")} />
          </Collapsible.Trigger>
          {onClear && events.length > 0 && !running && (
            <button type="button" aria-label="Clear activity" onClick={onClear} className={cn(iconButton, "size-7", focusRing)}>
              <Trash2Icon aria-hidden="true" />
            </button>
          )}
        </div>
        <Collapsible.Panel className={collapsiblePanel}>
          <div className="max-h-80 overflow-y-auto border-t border-border px-3 py-2">
            {hidden > 0 && <p className="pb-1 text-xs text-muted-foreground">{hidden} earlier events hidden</p>}
            <ol className="flex flex-col gap-1.5">
              {shown.map((event) => (
                <li key={event.id} data-kind={event.kind} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-3.5">{KIND_ICONS[event.kind]}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate">{event.title}</span>
                      {event.status && <StepStatusIcon status={event.status} className="size-3.5" />}
                      {event.durationMs !== undefined && <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{formatDuration(event.durationMs)}</span>}
                    </span>
                    {event.detail && <span className="text-xs text-muted-foreground">{event.detail}</span>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}
