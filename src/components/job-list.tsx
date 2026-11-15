// packages/ai-ui/src/components/job-list.tsx
"use client";

import { ChevronRightIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount, formatDuration } from "../lib/format.js";
import { type StepStatus, StepStatusIcon } from "../lib/step-status.js";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";

export interface Job {
  id: string;
  title: ReactNode;
  status: JobStatus;
  startedAt?: number;
  finishedAt?: number;
  /** 0 to 1 when known. */
  progress?: number;
  logs?: string[];
  cost?: number;
  /** What the job produced, e.g. before/after values or links to outputs. */
  result?: ReactNode;
  error?: string;
}

const STATUS: Record<JobStatus, { label: string; icon: StepStatus }> = {
  queued: { label: "Queued", icon: "pending" },
  running: { label: "Running", icon: "running" },
  succeeded: { label: "Succeeded", icon: "complete" },
  failed: { label: "Failed", icon: "failed" },
  cancelled: { label: "Cancelled", icon: "aborted" },
  unknown: { label: "Status unknown", icon: "warning" },
};

export interface JobListProps extends Omit<ComponentProps<"ul">, "children"> {
  jobs: Job[];
  unit?: string;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  /** Re-checks a job whose outcome was lost, before anyone retries it. */
  onReconcile?: (id: string) => void;
  /** Lines of log kept per job. */
  maxLogLines?: number;
  emptyLabel?: ReactNode;
}

function JobRow({ job, unit, onCancel, onRetry, onReconcile, maxLogLines }: { job: Job; unit: string; maxLogLines: number } & Pick<JobListProps, "onCancel" | "onRetry" | "onReconcile">) {
  const [open, setOpen] = useState(false);
  const active = job.status === "running" || job.status === "queued";
  const now = useNow(1000, job.status === "running" && job.startedAt !== undefined);
  const elapsed = job.startedAt !== undefined ? Math.max(0, (job.finishedAt ?? (job.status === "running" ? now : job.startedAt)) - job.startedAt) : undefined;
  const status = STATUS[job.status];
  const logs = job.logs && job.logs.length > maxLogLines ? job.logs.slice(-maxLogLines) : job.logs;
  const hasDetails = Boolean(job.logs?.length || job.result || job.error);

  return (
    <li data-status={job.status} className="flex flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <StepStatusIcon status={status.icon} />
        <span className="min-w-0 flex-1 truncate font-medium">{job.title}</span>
        <span className="text-xs text-muted-foreground">{status.label}</span>
        {elapsed !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(elapsed)}</span>}
        {job.cost !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{formatAmount(job.cost, unit)}</span>}
      </div>
      {job.status === "running" && job.progress !== undefined && (
        <div role="progressbar" aria-label="Job progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)} className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.max(0, job.progress * 100))}%` }} />
        </div>
      )}
      {job.status === "unknown" && (
        <p className="rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-xs">We lost track of this job. Check its real status before retrying so it does not run twice.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {hasDetails && (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={cn(button, buttonVariants.ghost, "h-7 px-2", focusRing)}>
            <ChevronRightIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", open && "rotate-90")} />
            {open ? "Hide details" : "Details"}
          </button>
        )}
        <span className="ml-auto flex gap-2">
          {active && onCancel && (
            <button type="button" onClick={() => onCancel(job.id)} className={cn(button, buttonVariants.outline, "h-7", focusRing)}>
              Cancel
            </button>
          )}
          {job.status === "unknown" && onReconcile && (
            <button type="button" onClick={() => onReconcile(job.id)} className={cn(button, buttonVariants.primary, "h-7", focusRing)}>
              Check status
            </button>
          )}
          {(job.status === "failed" || job.status === "cancelled") && onRetry && (
            <button type="button" onClick={() => onRetry(job.id)} className={cn(button, buttonVariants.outline, "h-7", focusRing)}>
              Retry
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          {job.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs">{job.error}</p>}
          {job.result && <div className="rounded-md border border-border p-2">{job.result}</div>}
          {logs && logs.length > 0 && (
            <pre role="log" aria-label="Job logs" tabIndex={0} className={cn("max-h-48 overflow-auto rounded-md bg-code-background p-2 font-mono text-xs text-code-foreground", focusRing)}>
              {logs.join("\n")}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

/** Background jobs with live status, progress, logs, cost, cancel, retry and reconcile for lost outcomes. */
export function JobList({ jobs, unit = "USD", onCancel, onRetry, onReconcile, maxLogLines = 200, emptyLabel = "No jobs yet.", className, ...props }: JobListProps) {
  if (jobs.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }
  return (
    <ul data-slot="job-list" className={cn("flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-sm text-card-foreground", className)} {...props}>
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} unit={unit} onCancel={onCancel} onRetry={onRetry} onReconcile={onReconcile} maxLogLines={maxLogLines} />
      ))}
    </ul>
  );
}
