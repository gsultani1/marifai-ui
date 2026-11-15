// packages/ai-ui/src/components/run-status-bar.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDownIcon, ClipboardCopyIcon, PauseIcon, PlayIcon, RotateCwIcon, SquareIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, collapsibleChevron, collapsiblePanel, focusRing, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatCompactNumber, formatDuration } from "../lib/format.js";

export type RunPhase = "idle" | "generating" | "applying" | "queued" | "paused" | "attention" | "complete" | "failed";

const PHASES: Record<RunPhase, { label: string; tone: Tone; active: boolean }> = {
  idle: { label: "Ready", tone: "neutral", active: false },
  generating: { label: "Generating", tone: "info", active: true },
  applying: { label: "Applying changes", tone: "info", active: true },
  queued: { label: "Waiting to apply", tone: "warning", active: true },
  paused: { label: "Paused", tone: "warning", active: false },
  attention: { label: "Needs attention", tone: "danger", active: false },
  complete: { label: "Complete", tone: "success", active: false },
  failed: { label: "Failed", tone: "danger", active: false },
};

const STOP_LABELS: Partial<Record<RunPhase, string>> = {
  generating: "Stop generation",
  applying: "Stop actions",
  queued: "Cancel queued",
  paused: "Cancel run",
};

export interface RunDetails {
  requestId?: string;
  provider?: string;
  model?: string;
  stage?: string;
  contextTokens?: number;
  outputTokens?: number;
  /** Queued or running actions with a short output snippet. */
  queue?: Array<{ id: string; label: string; status: string; snippet?: string }>;
}

export interface RunStatusBarProps extends Omit<ComponentProps<"div">, "children"> {
  phase: RunPhase;
  /** Epoch ms when the run started; drives the elapsed timer while active. */
  startedAt?: number | undefined;
  /** Elapsed time for finished runs, in ms. */
  elapsedMs?: number | undefined;
  running?: number;
  queued?: number;
  /** How many changes already reached the workspace. Retry is offered only when this is 0. */
  applied?: number;
  label?: ReactNode;
  onStop?: () => void;
  onRetry?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  details?: RunDetails;
  /** Text for "Copy receipt"; secrets should already be redacted. Defaults to the details as JSON. */
  receipt?: string;
}

/**
 * Strip above the composer that says what the agent is doing right now:
 * phase, elapsed time, running and queued counts, and the controls that make
 * sense for that phase. Retry only appears when nothing was applied yet, so
 * repeating the request cannot duplicate side effects.
 */
export function RunStatusBar({
  phase,
  startedAt,
  elapsedMs,
  running = 0,
  queued = 0,
  applied = 0,
  label,
  onStop,
  onRetry,
  onPause,
  onResume,
  details,
  receipt,
  className,
  ...props
}: RunStatusBarProps) {
  const config = PHASES[phase];
  const now = useNow(1000, config.active && startedAt !== undefined);
  const elapsed = config.active && startedAt !== undefined ? Math.max(0, now - startedAt) : elapsedMs;
  const { status: copyStatus, copy } = useCopyToClipboard();
  const stopLabel = STOP_LABELS[phase];
  const canRetry = Boolean(onRetry) && applied === 0 && (phase === "failed" || phase === "attention");
  const counts = [running > 0 ? `${running} running` : null, queued > 0 ? `${queued} queued` : null].filter(Boolean).join(" · ");
  const receiptText = receipt ?? (details ? JSON.stringify(details, null, 2) : undefined);

  return (
    <div
      data-slot="run-status-bar"
      data-phase={phase}
      className={cn("flex flex-col rounded-lg border border-border bg-card text-sm text-card-foreground", className)}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <span aria-hidden="true" className="relative flex size-2.5 shrink-0">
          {config.active && <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", toneDot[config.tone])} />}
          <span className={cn("relative size-2.5 rounded-full", toneDot[config.tone])} />
        </span>
        <span role="status" aria-atomic="true" className="min-w-0 flex-1 truncate">
          <span className="font-medium">{label ?? config.label}</span>
          {elapsed !== undefined && <span className="text-muted-foreground tabular-nums"> · {formatDuration(elapsed)}</span>}
          {counts && <span className="text-muted-foreground"> · {counts}</span>}
          {applied > 0 && (phase === "failed" || phase === "attention") && (
            <span className="text-muted-foreground"> · {applied} change{applied === 1 ? "" : "s"} already applied</span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {phase === "paused" && onResume && (
            <button type="button" onClick={onResume} className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}>
              <PlayIcon aria-hidden="true" />
              Resume
            </button>
          )}
          {config.active && onPause && (
            <button type="button" onClick={onPause} className={cn(button, buttonVariants.ghost, "h-7 px-2.5", focusRing)}>
              <PauseIcon aria-hidden="true" />
              Pause
            </button>
          )}
          {canRetry && (
            <button type="button" onClick={onRetry} className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}>
              <RotateCwIcon aria-hidden="true" />
              Retry
            </button>
          )}
          {stopLabel && onStop && (
            <button type="button" onClick={onStop} className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}>
              <SquareIcon aria-hidden="true" className="fill-current" />
              {stopLabel}
            </button>
          )}
        </div>
      </div>
      {details && (
        <Collapsible.Root className="border-t border-border">
          <Collapsible.Trigger className={cn("group flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground", focusRing)}>
            Request details
            <ChevronDownIcon aria-hidden="true" className={cn(collapsibleChevron, "size-3.5")} />
          </Collapsible.Trigger>
          <Collapsible.Panel className={collapsiblePanel}>
            <div className="flex flex-col gap-2 px-3 pb-3 text-xs">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {details.requestId && (
                  <>
                    <dt className="text-muted-foreground">Request</dt>
                    <dd className="truncate font-mono">{details.requestId}</dd>
                  </>
                )}
                {(details.provider || details.model) && (
                  <>
                    <dt className="text-muted-foreground">Model</dt>
                    <dd className="truncate">{[details.provider, details.model].filter(Boolean).join(" / ")}</dd>
                  </>
                )}
                {details.stage && (
                  <>
                    <dt className="text-muted-foreground">Stage</dt>
                    <dd>{details.stage}</dd>
                  </>
                )}
                {(details.contextTokens !== undefined || details.outputTokens !== undefined) && (
                  <>
                    <dt className="text-muted-foreground">Token limits</dt>
                    <dd className="tabular-nums">
                      {details.contextTokens !== undefined && `context ${formatCompactNumber(details.contextTokens)}`}
                      {details.contextTokens !== undefined && details.outputTokens !== undefined && " · "}
                      {details.outputTokens !== undefined && `output ${formatCompactNumber(details.outputTokens)}`}
                    </dd>
                  </>
                )}
              </dl>
              {details.queue && details.queue.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {details.queue.map((item) => (
                    <li key={item.id} className="flex min-w-0 flex-col rounded-md bg-muted/50 px-2 py-1">
                      <span className="truncate">
                        <span className="font-medium">{item.label}</span> <span className="text-muted-foreground">· {item.status}</span>
                      </span>
                      {item.snippet && <code className="truncate font-mono text-muted-foreground">{item.snippet}</code>}
                    </li>
                  ))}
                </ul>
              )}
              {receiptText && (
                <button
                  type="button"
                  onClick={() => void copy(receiptText)}
                  className={cn(button, buttonVariants.outline, "h-7 self-start px-2.5 text-xs", focusRing)}
                >
                  <ClipboardCopyIcon aria-hidden="true" />
                  {copyStatus === "copied" ? "Receipt copied" : copyStatus === "error" ? "Copy failed" : "Copy receipt"}
                </button>
              )}
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
    </div>
  );
}
