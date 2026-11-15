// packages/ai-ui/src/components/slider.tsx
"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "../lib/cn.js";

export interface SliderMark {
  value: number;
  /** Text under (or beside, when vertical) the track; omit for a tick only. */
  label?: ReactNode;
}

export interface SliderProps<Value extends number | readonly number[] = number> extends Omit<BaseSlider.Root.Props<Value>, "className" | "children" | "render"> {
  /** Visible label that names the slider; inside a FormField the field label does instead. */
  label?: ReactNode;
  /** Shows the current value (or "low – high" range) beside the label. Defaults to on when there is a label. */
  showValue?: boolean;
  /** Formats the value label and each thumb's `aria-valuetext`, such as `(v) => "$" + v`. */
  formatValue?: (value: number) => string;
  /** Ticks with optional labels along the track. */
  marks?: SliderMark[];
  /** Accessible name per thumb; range sliders default to "<label>, minimum" and "<label>, maximum". */
  thumbLabels?: string[];
  className?: string;
}

function percent(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/**
 * Single-value or range slider on Base UI Slider. Arrow keys step, Page Up and
 * Page Down take the large step, Home and End jump to the ends; `formatValue`
 * drives both the visible value and `aria-valuetext`, so "$120" is announced
 * instead of "120". Works horizontally or vertically (give vertical sliders a height).
 */
export function Slider<Value extends number | readonly number[] = number>({
  label,
  showValue = label !== undefined,
  formatValue,
  marks = [],
  thumbLabels,
  min = 0,
  max = 100,
  orientation = "horizontal",
  value,
  defaultValue,
  className,
  ...props
}: SliderProps<Value>) {
  const initial = value ?? defaultValue;
  const thumbCount = initial === undefined || typeof initial === "number" ? 1 : Math.max(1, initial.length);
  const vertical = orientation === "vertical";
  const ariaLabel = props["aria-label"];
  const name = typeof label === "string" ? label : ariaLabel;
  const thumbNames = thumbLabels ?? (thumbCount === 2 ? [name ? `${name}, minimum` : "Minimum", name ? `${name}, maximum` : "Maximum"] : label === undefined && ariaLabel ? [ariaLabel] : []);
  const format = (number: number, fallback: string) => (formatValue ? formatValue(number) : fallback);
  const position = (mark: SliderMark): CSSProperties => {
    const offset = percent(mark.value, min, max);
    return vertical ? { bottom: `${offset}%` } : { left: `${offset}%` };
  };

  return (
    <BaseSlider.Root<Value>
      data-slot="slider"
      min={min}
      max={max}
      orientation={orientation}
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      className={cn("flex min-w-0 flex-col gap-2", vertical ? "h-48 w-fit" : "w-full", className)}
      {...props}
    >
      {(label !== undefined || showValue) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {label !== undefined && <BaseSlider.Label className="font-medium text-foreground">{label}</BaseSlider.Label>}
          {showValue && (
            <BaseSlider.Value className="text-muted-foreground tabular-nums">
              {(formatted, values) => values.map((number, index) => format(number, formatted[index] ?? String(number))).join(" – ")}
            </BaseSlider.Value>
          )}
        </div>
      )}
      <div className={cn("flex min-h-0", vertical ? "flex-1 flex-row gap-2" : "flex-col gap-1.5")}>
        <BaseSlider.Control className={cn("relative flex touch-none items-center select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50", vertical ? "h-full w-5 flex-col" : "h-5 w-full")}>
          <BaseSlider.Track className={cn("relative grow rounded-full bg-muted", vertical ? "h-full w-1.5" : "h-1.5 w-full")}>
            <BaseSlider.Indicator className="rounded-full bg-primary" />
            {marks.map((mark) => (
              <span
                key={mark.value}
                aria-hidden="true"
                style={position(mark)}
                className={cn("absolute size-1 rounded-full bg-muted-foreground/60", vertical ? "left-1/2 -translate-x-1/2 translate-y-1/2" : "top-1/2 -translate-x-1/2 -translate-y-1/2")}
              />
            ))}
            {Array.from({ length: thumbCount }, (_, index) => (
              <BaseSlider.Thumb
                key={index}
                index={index}
                aria-label={thumbNames[index]}
                getAriaValueText={formatValue ? (_formatted, number) => formatValue(number) : undefined}
                className="size-4 rounded-full border-2 border-primary bg-background shadow-sm transition-shadow outline-none after:absolute after:-inset-2.5 after:content-[''] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background data-[dragging]:ring-2 data-[dragging]:ring-ring motion-reduce:transition-none"
              />
            ))}
          </BaseSlider.Track>
        </BaseSlider.Control>
        {marks.some((mark) => mark.label !== undefined) && (
          <div aria-hidden="true" className={cn("relative text-xs text-muted-foreground", vertical ? "h-full w-12" : "h-4 w-full")}>
            {marks.map((mark) =>
              mark.label === undefined ? null : (
                <span
                  key={mark.value}
                  style={position(mark)}
                  className={cn(
                    "absolute whitespace-nowrap tabular-nums",
                    vertical
                      ? "left-0 translate-y-1/2"
                      : mark.value <= min
                        ? "translate-x-0"
                        : mark.value >= max
                          ? "-translate-x-full"
                          : "-translate-x-1/2",
                  )}
                >
                  {mark.label}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </BaseSlider.Root>
  );
}
