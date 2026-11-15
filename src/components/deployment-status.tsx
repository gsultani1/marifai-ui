// packages/ai-ui/src/components/deployment-status.tsx
"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, FileTextIcon, RocketIcon, RotateCcwIcon, SquareIcon } from "lucide-react";
import { useId } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, card, focusRing, iconButton, type Tone } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDuration, formatRelativeTime } from "../lib/format.js";
import { safeUrl } from "../lib/safe-url.js";
import { type StepStatus, StepStatusIcon, stepStatusLabel } from "../lib/step-status.js";
import { StatusPill } from "./status-pill.js";

export type DeploymentState = "idle" | "queued" | "deploying" | "live" | "failed" | "canceled";

export interface DeploymentStep {
  id: string;
  label: string;
  status: StepStatus;
  startedAt?: number;
  finishedAt?: number;
  /** Shown under the step, e.g. an error summary. */
  detail?: string;
}

export interface DeploymentStatusProps {
  state: DeploymentState;
  steps?: DeploymentStep[];
  /** Live address once deployed. */
  url?: string;
  deployedAt?: number;
  /** e.g. "Production" or "Preview". */
  environment?: string;
  /** Version or commit being deployed, e.g. "1.4.0 (d470d5e)". */
  version?: string;
  onDeploy?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onRollback?: () => void;
  onViewLogs?: () => void;
  className?: string;
}

const STATE: Record<DeploymentState, { label: string; tone: Tone }> = {
  idle: { label: "Not deployed", tone: "neutral" },
  queued: { label: "Queued", tone: "neutral" },
  deploying: { label: "Deploying", tone: "info" },
  live: { label: "Live", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  canceled: { label: "Canceled", tone: "warning" },
};

/** Moves a deployment's steps forward: the step that finished is marked complete and the next one starts. */
export function advanceDeployment(steps: DeploymentStep[], now: number = Date.now()): DeploymentStep[] {
  const running = steps.findIndex((step) => step.status === "running");
  const index = running === -1 ? steps.findIndex((step) => step.status === "pending") : running;
  if (index === -1) return steps;
  return steps.map((step, position) => {
    if (position === index && step.status === "running") return { ...step, status: "complete", finishedAt: now };
    if (position === index && step.status === "pending") return { ...step, status: "running", startedAt: now };
    if (position === index + 1 && running !== -1 && step.status === "pending") return { ...step, status: "running", startedAt: now };
    return step;
  });
}

/**
 * Deployment progress and result: steps with their state and timing, the
 * overall status with elapsed time, and once live the address with copy,
 * open, redeploy and rollback; failures offer retry and logs.
 */
export function DeploymentStatus({ state, steps = [], url, deployedAt, environment, version, onDeploy, onCancel, onRetry, onRollback, onViewLogs, className }: DeploymentStatusProps) {
  const active = state === "deploying" || state === "queued";
  const now = useNow(1000, active || state === "live");
  const { copied, copy } = useCopyToClipboard();
  const id = useId();
  const href = safeUrl(url, ["http:", "https:"]);
  const meta = STATE[state];
  const started = steps.find((step) => step.startedAt !== undefined)?.startedAt;
  const finished = steps.reduce<number | undefined>((latest, step) => (step.finishedAt !== undefined && (latest === undefined || step.finishedAt > latest) ? step.finishedAt : latest), undefined);
  const elapsed = started === undefined ? undefined : Math.max(0, (active ? now : (finished ?? now)) - started);

  return (
    <section aria-labelledby={`${id}-title`} data-slot="deployment-status" data-state={state} className={cn(card, "flex flex-col gap-3 p-4 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <RocketIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="font-medium">
          {environment ? `${environment} deployment` : "Deployment"}
        </h3>
        {version && <span className="font-mono text-xs text-muted-foreground">{version}</span>}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {elapsed !== undefined && <span className="tabular-nums">{formatDuration(elapsed)}</span>}
          <StatusPill tone={meta.tone} pulse={state === "deploying"} live>
            {meta.label}
          </StatusPill>
        </span>
      </div>
      {steps.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {steps.map((step) => {
            const duration = step.startedAt === undefined ? undefined : Math.max(0, (step.finishedAt ?? (step.status === "running" ? now : step.startedAt)) - step.startedAt);
            return (
              <li key={step.id} data-status={step.status} className="flex items-start gap-2">
                <StepStatusIcon status={step.status} className="mt-0.5" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={cn(step.status === "pending" && "text-muted-foreground")}>
                    {step.label}
                    <span className="sr-only">, {stepStatusLabel(step.status)}</span>
                  </span>
                  {step.detail && <span className={cn("text-xs", step.status === "failed" ? "text-destructive" : "text-muted-foreground")}>{step.detail}</span>}
                </div>
                {duration !== undefined && step.status !== "pending" && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(duration)}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {state === "live" && href && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2">
          <a href={href} target="_blank" rel="noopener noreferrer" className={cn("min-w-0 flex-1 truncate font-medium underline underline-offset-2", focusRing)}>
            {href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
          {deployedAt !== undefined && <span className="text-xs">Deployed {formatRelativeTime(deployedAt, now)}</span>}
          <button type="button" aria-label={copied ? "Copied" : "Copy address"} title="Copy address" onClick={() => void copy(href)} className={cn(iconButton, "size-7", focusRing)}>
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          </button>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" title="Open in new tab" className={cn(iconButton, "size-7", focusRing)}>
            <ExternalLinkIcon aria-hidden="true" />
          </a>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onViewLogs && (state === "failed" || active || state === "live") && (
          <button type="button" onClick={onViewLogs} className={cn(button, buttonVariants.ghost, focusRing)}>
            <FileTextIcon aria-hidden="true" />
            Logs
          </button>
        )}
        {active && onCancel && (
          <button type="button" onClick={onCancel} className={cn(button, buttonVariants.outline, focusRing)}>
            <SquareIcon aria-hidden="true" />
            Cancel
          </button>
        )}
        {state === "live" && onRollback && (
          <button type="button" onClick={onRollback} className={cn(button, buttonVariants.outline, focusRing)}>
            <RotateCcwIcon aria-hidden="true" />
            Roll back
          </button>
        )}
        {(state === "failed" || state === "canceled") && onRetry && (
          <button type="button" onClick={onRetry} className={cn(button, buttonVariants.primary, focusRing)}>
            <RotateCcwIcon aria-hidden="true" />
            Retry
          </button>
        )}
        {(state === "idle" || state === "live") && onDeploy && (
          <button type="button" onClick={onDeploy} className={cn(button, state === "idle" ? buttonVariants.primary : buttonVariants.outline, focusRing)}>
            <RocketIcon aria-hidden="true" />
            {state === "idle" ? "Deploy" : "Redeploy"}
          </button>
        )}
      </div>
    </section>
  );
}
