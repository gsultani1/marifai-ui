// packages/ai-ui/src/components/run-panel.tsx
"use client";

import { PlayIcon, SquareIcon } from "lucide-react";
import { useId } from "react";

import { useNow } from "../hooks/use-now.js";
import { useApplePlatform } from "../hooks/use-shortcuts.js";
import { button, buttonVariants, focusRing, type Tone } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import type { ExecutionOutput } from "../lib/execution.js";
import { formatDuration } from "../lib/format.js";
import { formatShortcut } from "../lib/shortcuts.js";
import { ExecutionOutputView } from "./execution-output.js";
import { StatusPill } from "./status-pill.js";

export interface Runner {
  id: string;
  label: string;
  /** Shown under the picker, e.g. "python main.py". */
  command?: string;
}

export type RunStatus = "idle" | "running" | "succeeded" | "failed" | "stopped";

export interface RunPanelProps {
  runners: Runner[];
  runner: string;
  onRunnerChange: (id: string) => void;
  onRun: () => void;
  onStop?: () => void;
  status: RunStatus;
  outputs: ExecutionOutput[];
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  allowScripts?: boolean;
  label?: string;
  className?: string;
}

const STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  idle: { label: "Not run yet", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  succeeded: { label: "Succeeded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  stopped: { label: "Stopped", tone: "warning" },
};

/**
 * Run a program and see what it produced: runner picker, run and stop
 * (Ctrl or Cmd+Enter runs), status with elapsed time and exit code, and
 * outputs as text, images, sandboxed HTML, JSON or errors.
 */
export function RunPanel({ runners, runner, onRunnerChange, onRun, onStop, status, outputs, startedAt, finishedAt, exitCode, allowScripts = false, label = "Run", className }: RunPanelProps) {
  const running = status === "running";
  const now = useNow(250, running && startedAt !== undefined);
  const apple = useApplePlatform();
  const id = useId();
  const selected = runners.find((item) => item.id === runner);
  const elapsed = startedAt === undefined ? undefined : Math.max(0, (running ? now : (finishedAt ?? now)) - startedAt);
  const meta = STATUS[status];

  return (
    <section
      aria-labelledby={`${id}-title`}
      data-slot="run-panel"
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !running) {
          event.preventDefault();
          onRun();
        }
      }}
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background", className)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h3 id={`${id}-title`} className="sr-only">
          {label}
        </h3>
        <label className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-muted-foreground">Runner</span>
          <select value={runner} onChange={(event) => onRunnerChange(event.target.value)} disabled={running} className={cn("h-8 min-w-0 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60", focusRing)}>
            {runners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <button type="button" onClick={onStop} disabled={!onStop} className={cn(button, buttonVariants.destructive, focusRing)}>
            <SquareIcon aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button type="button" onClick={onRun} aria-keyshortcuts={apple ? "Meta+Enter" : "Control+Enter"} title={`Run (${formatShortcut("mod+enter", apple)})`} className={cn(button, buttonVariants.primary, focusRing)}>
            <PlayIcon aria-hidden="true" />
            Run
          </button>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <StatusPill tone={meta.tone} pulse={running} live>
            {meta.label}
            {exitCode !== undefined && !running ? ` (exit ${exitCode})` : ""}
          </StatusPill>
          {elapsed !== undefined && <span className="tabular-nums">{formatDuration(elapsed)}</span>}
        </span>
        {selected?.command && <code className="w-full truncate font-mono text-xs text-muted-foreground">{selected.command}</code>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {outputs.length ? <ExecutionOutputView outputs={outputs} allowScripts={allowScripts} /> : <p className="text-sm text-muted-foreground">{running ? "Waiting for output…" : "Run the program to see its output here."}</p>}
      </div>
    </section>
  );
}
