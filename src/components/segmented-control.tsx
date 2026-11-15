// packages/ai-ui/src/components/segmented-control.tsx
"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { ReactNode } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { cn } from "../lib/cn.js";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Second line under the label; switches the control to a card layout. */
  description?: ReactNode;
  disabled?: boolean;
  /** Required when the label is an icon only. */
  "aria-label"?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  /** Stretches segments to fill the width. */
  fullWidth?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/**
 * One choice from a few, as a segmented bar or (with descriptions) a row of
 * cards. It is a radio group: one tab stop, arrows move and select.
 */
export function SegmentedControl<T extends string = string>({ options, value, defaultValue, onValueChange, label, size = "md", fullWidth = false, disabled = false, name, className }: SegmentedControlProps<T>) {
  const [selected, setSelected] = useControllableState<T | undefined>({ value, defaultValue: defaultValue ?? options[0]?.value, onChange: (next) => next !== undefined && onValueChange?.(next) });
  const cards = options.some((option) => option.description);
  return (
    <RadioGroup
      aria-label={label}
      value={selected}
      onValueChange={(next) => setSelected(next as T)}
      disabled={disabled}
      name={name}
      className={cn(cards ? "grid gap-2 sm:grid-flow-col sm:auto-cols-fr" : "inline-flex gap-0.5 rounded-lg bg-muted p-0.5", fullWidth && !cards && "flex w-full", className)}
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option["aria-label"]}
          className={cn(
            "outline-none focus-visible:ring-2 focus-visible:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
            cards
              ? "flex cursor-pointer flex-col gap-0.5 rounded-lg border border-border bg-background p-3 text-left hover:bg-accent/40 data-[checked]:border-ring data-[checked]:ring-1 data-[checked]:ring-ring"
              : cn(
                  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium text-muted-foreground transition-colors hover:text-foreground data-[checked]:bg-background data-[checked]:text-foreground data-[checked]:shadow-sm [&_svg]:size-4",
                  size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
                  fullWidth && "flex-1",
                ),
          )}
        >
          {cards ? (
            <>
              <span className="flex items-center gap-2 text-sm font-medium [&_svg]:size-4">
                {option.icon}
                {option.label}
              </span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </>
          ) : (
            <>
              {option.icon}
              {option.label}
            </>
          )}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
