// packages/ai-ui/src/components/export-progress.tsx
"use client";

import { CircleAlertIcon, CircleCheckIcon, DownloadIcon, FileDownIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useId } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatBytes, formatDuration } from "../lib/format.js";

export type ExportStatus = "preparing" | "exporting" | "ready" | "failed" | "canceled";

export interface ExportProgressProps {
  /** e.g. "PDF", "PNG" or "ZIP". */
  format: string;
  fileName?: string;
  status: ExportStatus;
  /** 0 to 1 when known; omit while the amount of work is unknown. */
  progress?: number;
  /** What is happening now, e.g. "Rendering page 3 of 12". */
  stage?: string;
  startedAt?: number;
  /** Size of the finished file in bytes. */
  size?: number;
  error?: string;
  onCancel?: () => void;
  onDownload?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/** Seconds left at the current rate, once enough of the export has run to estimate it. */
export function estimateRemaining(progress: number | undefined, elapsed: number): number | undefined {
  if (progress === undefined || progress < 0.05 || progress >= 1 || elapsed < 1000) return undefined;
  return (elapsed * (1 - progress)) / progress;
}

/**
 * Progress of a file export: the stage, a determinate or indeterminate bar,
 * elapsed time and an estimate of what's left, then download, or the error
 * with retry; cancel while it runs.
 */
export function ExportProgress({ format, fileName, status, progress, stage, startedAt, size, error, onCancel, onDownload, onRetry, onDismiss, className }: ExportProgressProps) {
  const active = status === "preparing" || status === "exporting";
  const now = useNow(1000, active && startedAt !== undefined);
  const id = useId();
  const elapsed = startedAt === undefined ? 0 : Math.max(0, now - startedAt);
  const remaining = active ? estimateRemaining(progress, elapsed) : undefined;
  const percent = progress === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const name = fileName ?? `${format} export`;
  const title = status === "ready" ? `${name} is ready` : status === "failed" ? `Couldn't export ${name}` : status === "canceled" ? `Export of ${name} canceled` : `Exporting ${name}`;
  const detail =
    status === "ready"
      ? [format, size !== undefined ? formatBytes(size) : ""].filter(Boolean).join(" · ")
      : status === "failed"
        ? (error ?? "Something went wrong while exporting.")
        : status === "canceled"
          ? "Nothing was saved."
          : [status === "preparing" ? "Preparing…" : stage, remaining !== undefined ? `about ${formatDuration(remaining)} left` : ""].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby={`${id}-title`} data-slot="export-progress" data-status={status} className={cn(card, "flex flex-col gap-2 p-3 text-sm", className)}>
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className={cn("mt-0.5 [&_svg]:size-4", status === "ready" ? "text-success" : status === "failed" ? "text-destructive" : "text-muted-foreground")}>
          {status === "ready" ? <CircleCheckIcon /> : status === "failed" ? <CircleAlertIcon /> : <FileDownIcon />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 id={`${id}-title`} className="truncate font-medium">
            {title}
          </h3>
          <p role={status === "failed" ? "alert" : "status"} className={cn("text-xs", status === "failed" ? "text-destructive" : "text-muted-foreground")}>
            {detail}
          </p>
        </div>
        {active && startedAt !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(elapsed)}</span>}
        {!active && onDismiss && (
          <button type="button" aria-label="Dismiss" title="Dismiss" onClick={onDismiss} className={cn(iconButton, "size-7", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </div>
      {active && (
        <div
          role="progressbar"
          aria-labelledby={`${id}-title`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={percent === undefined ? (stage ?? "Working") : `${percent}%`}
          className="relative h-1.5 overflow-hidden rounded-full bg-muted"
        >
          {percent === undefined ? (
            <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary motion-safe:animate-pulse" />
          ) : (
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 empty:hidden">
        {active && onCancel && (
          <button type="button" onClick={onCancel} className={cn(button, buttonVariants.ghost, focusRing)}>
            Cancel
          </button>
        )}
        {(status === "failed" || status === "canceled") && onRetry && (
          <button type="button" onClick={onRetry} className={cn(button, buttonVariants.outline, focusRing)}>
            <RotateCcwIcon aria-hidden="true" />
            Try again
          </button>
        )}
        {status === "ready" && onDownload && (
          <button type="button" onClick={onDownload} className={cn(button, buttonVariants.primary, focusRing)}>
            <DownloadIcon aria-hidden="true" />
            Download
          </button>
        )}
      </div>
    </section>
  );
}
