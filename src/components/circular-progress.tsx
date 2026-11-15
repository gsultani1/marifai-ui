// packages/ai-ui/src/components/circular-progress.tsx
"use client";

import { Progress } from "@base-ui/react/progress";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn.js";

export type CircularProgressTone = "primary" | "info" | "success" | "warning" | "danger";

const TONE_STROKE: Record<CircularProgressTone, string> = {
  primary: "var(--primary)",
  info: "var(--chart-1)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
};

const SIZES = { sm: 24, md: 48, lg: 72, xl: 96 } as const;

export interface CircularProgressProps extends Omit<ComponentProps<"div">, "children" | "defaultValue" | "defaultChecked" | "color"> {
  /** Current value; null or undefined shows an indeterminate spinner. */
  value?: number | null;
  min?: number;
  max?: number;
  /** Accessible name, such as "Cycle count progress". */
  label: string;
  /** A preset or a diameter in pixels. */
  size?: keyof typeof SIZES | number;
  tone?: CircularProgressTone;
  /** Ring width in pixels; defaults to a tenth of the diameter. */
  thickness?: number;
  /** Shows the value in the center (sizes from 40 pixels). */
  showValue?: boolean;
  /** Formats the center text and the spoken value; defaults to a whole percent. */
  formatValue?: (value: number, percent: number) => string;
  /** Replaces the center text. */
  children?: ReactNode;
}

/**
 * Ring-shaped progress indicator built on Base UI Progress: determinate
 * with a centered value, or an indeterminate spinner (static under reduced
 * motion) marked busy. Exposes role="progressbar" with aria-valuenow and a
 * spoken value. Sizes sm to xl or any diameter, in five tones.
 */
export function CircularProgress({ value, min = 0, max = 100, label, size = "md", tone = "primary", thickness, showValue = true, formatValue, children, className, style, ...props }: CircularProgressProps) {
  const diameter = typeof size === "number" ? Math.max(12, size) : SIZES[size];
  const stroke = thickness ?? Math.max(2.5, diameter / 10);
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const indeterminate = value === null || value === undefined || !Number.isFinite(value);
  const clamped = indeterminate ? min : Math.min(max, Math.max(min, value));
  const percent = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
  const text = indeterminate ? "" : formatValue ? formatValue(clamped, percent) : `${Math.round(percent)}%`;
  const center = children ?? (showValue && !indeterminate && diameter >= 40 ? text : null);
  const arc = indeterminate ? 0.25 : percent / 100;

  return (
    <Progress.Root
      value={indeterminate ? null : clamped}
      min={min}
      max={max}
      aria-label={label}
      aria-busy={indeterminate || undefined}
      getAriaValueText={() => (indeterminate ? "Loading" : text)}
      data-slot="circular-progress"
      data-tone={tone}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: diameter, height: diameter, ...style }}
      {...props}
    >
      <svg viewBox={`0 0 ${diameter} ${diameter}`} width={diameter} height={diameter} aria-hidden="true" className={cn("-rotate-90", indeterminate && "motion-safe:animate-spin")}>
        <circle cx={diameter / 2} cy={diameter / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap={arc > 0 ? "round" : "butt"}
          strokeDasharray={`${circumference * arc} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
        />
      </svg>
      {center !== null && center !== undefined && (
        <span aria-hidden="true" className={cn("absolute inset-0 flex items-center justify-center font-semibold text-foreground tabular-nums", diameter >= 72 ? "text-base" : "text-xs")}>
          {center}
        </span>
      )}
    </Progress.Root>
  );
}
