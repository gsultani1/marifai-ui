// packages/ai-ui/src/experimental/agent-run-queue.tsx
"use client";

import { useId } from "react";

import { cn } from "../lib/cn.js";
import { Badge } from "../components/badge.js";
import { Button } from "../components/button.js";

export type AgentQueueStatus = "queued" | "running" | "paused" | "failed" | "completed" | "canceled";

export interface AgentQueueRun {
  id: string;
  title: string;
  agent?: string;
  status: AgentQueueStatus;
  detail?: string;
}

export interface AgentRunQueueProps {
  runs: readonly AgentQueueRun[];
  /** The host applies actions and supplies updated run state. */
  onOpen?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRetry?: (id: string) => void;
  pendingRunIds?: readonly string[];
  className?: string;
}

const statusLabels: Record<AgentQueueStatus, string> = {
  queued: "Queued",
  running: "Running",
  paused: "Paused",
  failed: "Failed",
  completed: "Completed",
  canceled: "Canceled",
};

export function AgentRunQueue({
  runs, onOpen, onPause, onResume, onRetry, pendingRunIds = [], className,
}: AgentRunQueueProps) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} data-slot="agent-run-queue" className={cn("min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground", className)}>
      <h3 id={heading} className="text-sm font-semibold">Agent runs</h3>
      {runs.length ? (
        <ul className="mt-2 divide-y divide-border">
          {runs.map((run) => {
            const busy = pendingRunIds.includes(run.id);
            const action = run.status === "running" ? onPause : run.status === "paused" ? onResume : run.status === "failed" ? onRetry : undefined;
            const label = run.status === "running" ? "Pause" : run.status === "paused" ? "Resume" : "Retry";
            return (
              <li key={run.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">{run.title}</span>
                    <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{statusLabels[run.status]}</Badge>
                  </div>
                  {run.agent && <p className="text-xs break-words text-muted-foreground">{run.agent}</p>}
                  {run.detail && <p className="text-xs break-words text-muted-foreground">{run.detail}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {onOpen && <Button type="button" size="sm" variant="ghost" aria-label={`Open ${run.title}`} onClick={() => onOpen(run.id)}>Open</Button>}
                  {action && (
                    <Button type="button" size="sm" variant="outline" loading={busy} aria-label={`${label} ${run.title}`} onClick={() => action(run.id)}>
                      {label}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-2 text-sm text-muted-foreground">No agent runs yet.</p>}
    </section>
  );
}
