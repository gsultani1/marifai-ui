// packages/ai-ui/src/components/fieldset.tsx
"use client";

import { Fieldset as BaseFieldset } from "@base-ui/react/fieldset";
import { type ReactNode, useId } from "react";

import { cn } from "../lib/cn.js";

export interface FieldsetProps extends Omit<BaseFieldset.Root.Props, "className"> {
  /** Shorthand for a FieldsetLegend as the first child. */
  legend?: ReactNode;
  /** Help text under the legend, linked to the group with `aria-describedby`. */
  description?: ReactNode;
  /** Disables every native and Base UI control inside, including nested FormFields. */
  disabled?: boolean;
  className?: string;
}

/**
 * Groups related controls under a legend on Base UI Fieldset. The legend names
 * the group for assistive tech, and `disabled` reaches every control inside
 * through the native fieldset and the Base UI field context.
 */
export function Fieldset({ legend, description, disabled = false, className, children, "aria-describedby": describedBy, ...props }: FieldsetProps) {
  const descriptionId = useId();
  return (
    <BaseFieldset.Root
      data-slot="fieldset"
      disabled={disabled}
      aria-describedby={[describedBy, description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
      className={cn("m-0 flex min-w-0 flex-col gap-4 border-0 p-0", className)}
      {...props}
    >
      {(legend || description) && (
        <div className="flex flex-col gap-1">
          {legend && <FieldsetLegend>{legend}</FieldsetLegend>}
          {description && (
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </BaseFieldset.Root>
  );
}

export interface FieldsetLegendProps extends Omit<BaseFieldset.Legend.Props, "className"> {
  className?: string;
}

/** The fieldset's visible title; Base UI links it to the fieldset with `aria-labelledby`. */
export function FieldsetLegend({ className, ...props }: FieldsetLegendProps) {
  return <BaseFieldset.Legend data-slot="fieldset-legend" className={cn("text-base font-semibold text-foreground data-[disabled]:text-muted-foreground", className)} {...props} />;
}
