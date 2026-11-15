// packages/ai-ui/src/components/model-card.tsx
"use client";

import { CheckIcon, CircleAlertIcon, CpuIcon, DownloadIcon, PauseIcon, PlayIcon, Trash2Icon, XIcon } from "lucide-react";
import { useId } from "react";

import { badge, button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatBytes, formatDuration } from "../lib/format.js";

export type LocalModelStatus = "available" | "downloading" | "paused" | "installed" | "error";

export interface ModelCardProps {
  name: string;
  /** e.g. "Llama 3.1" or "Qwen 2.5". */
  family?: string;
  /** e.g. "8B". */
  parameters?: string;
  /** e.g. "Q4_K_M". */
  quantization?: string;
  sizeBytes?: number;
  contextWindow?: number;
  description?: string;
  status: LocalModelStatus;
  /** 0 to 1 while downloading or paused. */
  progress?: number;
  /** Bytes per second. */
  speed?: number;
  error?: string;
  /** This model is the one in use. */
  active?: boolean;
  onDownload?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onUse?: () => void;
  className?: string;
}

/**
 * A local model: family, size, quantization and context, then download
 * with progress, speed and time left, pause, resume and cancel, and once
 * installed Use and Delete.
 */
export function ModelCard({ name, family, parameters, quantization, sizeBytes, contextWindow, description, status, progress = 0, speed, error, active = false, onDownload, onPause, onResume, onCancel, onDelete, onUse, className }: ModelCardProps) {
  const id = useId();
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const downloaded = sizeBytes !== undefined ? sizeBytes * Math.min(1, Math.max(0, progress)) : undefined;
  const remaining = status === "downloading" && speed && sizeBytes !== undefined && downloaded !== undefined ? ((sizeBytes - downloaded) / speed) * 1000 : undefined;
  const inProgress = status === "downloading" || status === "paused";

  return (
    <article aria-labelledby={`${id}-name`} data-slot="model-card" data-status={status} className={cn(card, "flex flex-col gap-2 p-3 text-sm", active && "border-ring ring-1 ring-ring", className)}>
      <div className="flex items-start gap-2">
        <CpuIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 id={`${id}-name`} className="truncate font-medium">
            {name}
          </h3>
          {family && <span className="text-xs text-muted-foreground">{family}</span>}
        </div>
        {active && (
          <span className={cn(badge, "border-primary/40")}>
            <CheckIcon aria-hidden="true" />
            In use
          </span>
        )}
        {status === "installed" && !active && <span className={badge}>Installed</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {parameters && <span className={badge}>{parameters} parameters</span>}
        {quantization && <span className={cn(badge, "font-mono")}>{quantization}</span>}
        {sizeBytes !== undefined && <span className={badge}>{formatBytes(sizeBytes)}</span>}
        {contextWindow !== undefined && <span className={badge}>{contextWindow >= 1000 ? `${Math.round(contextWindow / 1000)}K` : contextWindow} context</span>}
      </div>
      {description && <p className="text-muted-foreground">{description}</p>}
      {inProgress && (
        <div className="flex flex-col gap-1">
          <div role="progressbar" aria-labelledby={`${id}-name`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% downloaded${status === "paused" ? ", paused" : ""}`} className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full transition-[width] motion-reduce:transition-none", status === "paused" ? "bg-muted-foreground" : "bg-primary")} style={{ width: `${percent}%` }} />
          </div>
          <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground tabular-nums">
            <span>
              {percent}%{downloaded !== undefined && sizeBytes !== undefined ? ` · ${formatBytes(downloaded)} of ${formatBytes(sizeBytes)}` : ""}
            </span>
            {status === "paused" ? <span>Paused</span> : speed ? <span>{formatBytes(speed)}/s</span> : null}
            {remaining !== undefined && <span>about {formatDuration(remaining)} left</span>}
          </p>
        </div>
      )}
      {status === "error" && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <CircleAlertIcon aria-hidden="true" className="size-3.5" />
          {error ?? "The download failed."}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(status === "available" || status === "error") && onDownload && (
          <button type="button" onClick={onDownload} className={cn(button, status === "error" ? buttonVariants.outline : buttonVariants.primary, focusRing)}>
            <DownloadIcon aria-hidden="true" />
            {status === "error" ? "Try again" : "Download"}
          </button>
        )}
        {status === "downloading" && onPause && (
          <button type="button" onClick={onPause} className={cn(button, buttonVariants.outline, focusRing)}>
            <PauseIcon aria-hidden="true" />
            Pause
          </button>
        )}
        {status === "paused" && onResume && (
          <button type="button" onClick={onResume} className={cn(button, buttonVariants.outline, focusRing)}>
            <PlayIcon aria-hidden="true" />
            Resume
          </button>
        )}
        {inProgress && onCancel && (
          <button type="button" aria-label={`Cancel download of ${name}`} title="Cancel download" onClick={onCancel} className={cn(iconButton, focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
        {status === "installed" && onDelete && (
          <button type="button" aria-label={`Delete ${name}`} title="Delete" onClick={onDelete} className={cn(iconButton, "hover:text-destructive", focusRing)}>
            <Trash2Icon aria-hidden="true" />
          </button>
        )}
        {status === "installed" && onUse && !active && (
          <button type="button" onClick={onUse} className={cn(button, buttonVariants.primary, focusRing)}>
            Use
          </button>
        )}
      </div>
    </article>
  );
}
