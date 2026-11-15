// packages/ai-ui/src/components/otp-input.tsx
"use client";

import { OTPField } from "@base-ui/react/otp-field";
import { Fragment, useId } from "react";

import { cn } from "../lib/cn.js";

export interface OTPInputProps extends Omit<OTPField.Root.Props, "children" | "className" | "render"> {
  /** Slot counts per group, such as [3, 3], with a separator between groups. Defaults to one group. */
  groups?: number[];
  /** Screen-reader label when the field has no FormField label; rendered as a visually hidden label element. */
  "aria-label"?: string;
  className?: string;
}

const slot =
  "size-10 rounded-md border border-input bg-background text-center text-lg font-medium text-foreground tabular-nums caret-transparent outline-none focus:border-ring focus:ring-2 focus:ring-ring data-[filled]:border-foreground/40 data-[invalid]:border-destructive disabled:opacity-50";

/**
 * One-time code field on Base UI OTPField: one slot per character with
 * autofill from SMS (`one-time-code`), paste that fills every slot, arrow and
 * Backspace navigation, numeric or alphanumeric validation, optional masking
 * and grouping, and `onValueComplete` (or `autoSubmit`) when the code is full.
 */
export function OTPInput({ length, groups, "aria-label": ariaLabel, id, className, ...props }: OTPInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const layout = groups && groups.reduce((sum, count) => sum + count, 0) === length ? groups : [length];
  const offsets = layout.map((_, group) => layout.slice(0, group).reduce((sum, count) => sum + count, 0));
  return (
    <>
    {ariaLabel && (
      <label htmlFor={inputId} className="sr-only">
        {ariaLabel}
      </label>
    )}
    <OTPField.Root id={inputId} length={length} className={cn("flex items-center gap-2", className)} {...props}>
      {layout.map((count, group) => (
        <Fragment key={group}>
          {group > 0 && <OTPField.Separator className="h-0.5 w-3 rounded bg-border" />}
          <div className="flex gap-1.5">
            {Array.from({ length: count }, (_, slotIndex) => {
              const position = offsets[group]! + slotIndex;
              return <OTPField.Input key={position} aria-label={position === 0 ? undefined : `Character ${position + 1} of ${length}`} className={slot} />;
            })}
          </div>
        </Fragment>
      ))}
    </OTPField.Root>
    </>
  );
}
