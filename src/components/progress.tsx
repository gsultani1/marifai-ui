// packages/ai-ui/src/components/progress.tsx
"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";

/** Fill color of Progress and Meter bars. */
export type BarTone = "default" | "success" | "warning" | "danger";

/** Sets `--bar-color`, which bar indicators read; shared by Progress and Meter. */
export const barToneColor: Record<BarTone, string> = {
  default: "[--bar-color:var(--primary)]",
  success: "[--bar-color:var(--success)]",
  warning: "[--bar-color:var(--warning)]",
  danger: "[--bar-color:var(--destructive)]",
};

/** Track heights shared by Progress and Meter. */
export const barTrackSizes = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
} as const;

export type BarSize = keyof typeof barTrackSizes;

export interface ProgressProps extends Omit<BaseProgress.Root.Props, "className" | "children" | "render"> {
  /** Visible label that names the bar; without it pass `aria-label`. */
  label?: ReactNode;
  /** Shows the formatted value (or `valueText`) beside the label. */
  showValue?: boolean;
  /** Replaces the percentage, such as "3 of 8 files"; also used as `aria-valuetext` when it is a string. */
  valueText?: ReactNode;
  tone?: BarTone;
  size?: BarSize;
  className?: string;
}

/**
 * Determinate or indeterminate (`value={null}`) progress bar on Base UI
 * Progress with a label, formatted value and tones. The indeterminate sweep
 * stops under reduced motion and shows a static partial bar.
 */
export function Progress({ value, label, showValue = label !== undefined, valueText, tone = "default", size = "md", className, "aria-valuetext": ariaValueText, ...props }: ProgressProps) {
  const indeterminate = value === null;
  return (
    <BaseProgress.Root
      data-slot="progress"
      data-tone={tone}
      value={value}
      aria-valuetext={ariaValueText ?? (typeof valueText === "string" ? valueText : undefined)}
      className={cn("flex w-full min-w-0 flex-col gap-1.5", barToneColor[tone], className)}
      {...props}
    >
      {(label !== undefined || showValue) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {label !== undefined && <BaseProgress.Label className="font-medium text-foreground">{label}</BaseProgress.Label>}
          {showValue && !indeterminate && <BaseProgress.Value className="text-muted-foreground tabular-nums">{valueText === undefined ? undefined : () => valueText}</BaseProgress.Value>}
        </div>
      )}
      <BaseProgress.Track className={cn("relative w-full overflow-hidden rounded-full bg-muted", barTrackSizes[size])}>
        <BaseProgress.Indicator
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
            indeterminate
              ? "w-full motion-safe:animate-shimmer motion-safe:bg-[linear-gradient(90deg,transparent_20%,var(--bar-color)_50%,transparent_80%)] motion-safe:bg-[length:200%_100%] motion-reduce:w-1/3 motion-reduce:bg-[color:var(--bar-color)]"
              : "bg-[color:var(--bar-color)]",
          )}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}
