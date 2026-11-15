// packages/ai-ui/src/components/input-counter.tsx
import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";

export interface InputCounterProps extends Omit<ComponentProps<"span">, "children"> {
  value: string;
  max: number;
  /** Counts words instead of characters. */
  unit?: "characters" | "words";
  /** Fraction of `max` at which the counter turns into a warning and starts announcing. */
  warnAt?: number;
}

export function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** "1,240 / 2,000" under a field, announced only once the limit is close. */
export function InputCounter({ value, max, unit = "characters", warnAt = 0.9, className, ...props }: InputCounterProps) {
  const count = unit === "words" ? countWords(value) : value.length;
  const near = count >= max * warnAt;
  const over = count > max;
  return (
    <span
      aria-live={near ? "polite" : "off"}
      data-slot="input-counter"
      data-state={over ? "over" : near ? "near" : "ok"}
      className={cn("text-xs tabular-nums text-muted-foreground", over && "font-medium text-destructive", className)}
      {...props}
    >
      {count.toLocaleString()} / {max.toLocaleString()}
      <span className="sr-only"> {unit}{over ? `, ${(count - max).toLocaleString()} over the limit` : ""}</span>
    </span>
  );
}
