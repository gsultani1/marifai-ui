// packages/ai-ui/src/components/meter.tsx
"use client";

import { Meter as BaseMeter } from "@base-ui/react/meter";
import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";
import { type BarSize, barToneColor, barTrackSizes } from "./progress.js";

/** How good a meter reading is, following the HTML `<meter>` low, high and optimum regions. */
export type MeterTone = "success" | "warning" | "danger";

export interface MeterThresholds {
  value: number;
  min?: number;
  max?: number;
  /** Upper bound of the low region. */
  low?: number;
  /** Lower bound of the high region. */
  high?: number;
  /** The best value; its region is good, the adjacent one is a warning and the far one is danger. */
  optimum?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Tone for a reading using the HTML `<meter>` algorithm: the region holding
 * `optimum` is "success", a neighbouring region "warning" and the region two
 * steps away "danger". With `optimum` between `low` and `high`, readings
 * outside that band are only a warning.
 */
export function getMeterTone({ value, min = 0, max = 100, low, high, optimum }: MeterThresholds): MeterTone {
  const upper = Math.max(min, max);
  const current = clamp(value, min, upper);
  const lowBound = clamp(low ?? min, min, upper);
  const highBound = clamp(high ?? upper, lowBound, upper);
  const best = clamp(optimum ?? (min + upper) / 2, min, upper);
  if (best < lowBound) {
    if (current <= lowBound) return "success";
    return current <= highBound ? "warning" : "danger";
  }
  if (best > highBound) {
    if (current >= highBound) return "success";
    return current >= lowBound ? "warning" : "danger";
  }
  return current >= lowBound && current <= highBound ? "success" : "warning";
}

export interface MeterProps extends Omit<BaseMeter.Root.Props, "className" | "children" | "render">, Pick<MeterThresholds, "low" | "high" | "optimum"> {
  /** Visible label that names the meter; without it pass `aria-label`. */
  label?: ReactNode;
  /** Shows the formatted value beside the label. Defaults to on when there is a label. */
  showValue?: boolean;
  /** Formats the visible value and `aria-valuetext`, such as `(v) => v + " units"`. */
  formatValue?: (value: number) => string;
  /** Words per tone, such as `{ danger: "Low stock" }`, shown beside the value and announced, so color is not the only cue. */
  statusText?: Partial<Record<MeterTone, string>>;
  /** Overrides the computed tone. */
  tone?: MeterTone;
  size?: BarSize;
  className?: string;
}

/**
 * A reading within a known range on Base UI Meter (`role="meter"`), such as
 * stock on hand or storage used. `low`, `high` and `optimum` pick the success,
 * warning or danger fill the way a native `<meter>` does.
 */
export function Meter({ value, min = 0, max = 100, low, high, optimum, label, showValue = label !== undefined, formatValue, statusText, tone, size = "md", className, getAriaValueText, "aria-valuetext": ariaValueText, ...props }: MeterProps) {
  const resolved = tone ?? getMeterTone({ value, min, max, low, high, optimum });
  const status = statusText?.[resolved];
  return (
    <BaseMeter.Root
      data-slot="meter"
      data-tone={resolved}
      value={value}
      min={min}
      max={max}
      getAriaValueText={(formatted, number) => {
        const text = ariaValueText ?? (getAriaValueText ? getAriaValueText(formatted, number) : formatValue ? formatValue(number) : formatted);
        return status ? `${text}, ${status}` : text;
      }}
      className={cn("flex w-full min-w-0 flex-col gap-1.5", barToneColor[resolved], className)}
      {...props}
    >
      {(label !== undefined || showValue) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {label !== undefined && <BaseMeter.Label className="font-medium text-foreground">{label}</BaseMeter.Label>}
          {showValue && (
            <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
              {status && <span className="font-medium text-foreground">{status}</span>}
              <BaseMeter.Value>{formatValue ? (_formatted, number) => formatValue(number) : undefined}</BaseMeter.Value>
            </span>
          )}
        </div>
      )}
      <BaseMeter.Track className={cn("relative w-full overflow-hidden rounded-full bg-muted", barTrackSizes[size])}>
        <BaseMeter.Indicator className="h-full rounded-full bg-[color:var(--bar-color)] transition-[width] duration-300 ease-out motion-reduce:transition-none" />
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}
