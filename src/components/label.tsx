// packages/ai-ui/src/components/label.tsx
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn.js";

export interface LabelProps extends ComponentProps<"label"> {
  /** Shows a required marker; put `required` on the control for validation. */
  required?: boolean;
  /** Shows "(optional)" after the text. */
  optional?: boolean;
  /** Dims the label for a disabled control while keeping the text readable. */
  disabled?: boolean;
}

/**
 * Form label with required and optional markers. Use `htmlFor` or wrap the
 * control for a standalone field; inside a Base UI Field compose it as
 * `<Field.Label render={<Label required />}>Name</Field.Label>` so the field
 * wires its id and `htmlFor` to the control.
 */
export function Label({ required = false, optional = false, disabled = false, className, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      data-disabled={disabled || undefined}
      className={cn("inline-flex items-center gap-1 text-sm leading-5 font-medium text-foreground data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground", className)}
      {...props}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      )}
      {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
    </label>
  );
}

export interface LabeledControlProps {
  /** The checkbox, radio or switch element. */
  control: ReactNode;
  /** Id of the labelable control, used as the label's `htmlFor`. */
  controlId: string | undefined;
  label?: ReactNode;
  description?: ReactNode;
  descriptionId: string;
  disabled?: boolean | undefined;
  /** "end" puts the control after the text and stretches the row. */
  controlPosition?: "start" | "end";
  slot: string;
  className?: string | undefined;
  labelClassName?: string | undefined;
}

/** Control beside its label and description; the layout shared by Checkbox, Switch and RadioGroupItem. */
export function LabeledControl({ control, controlId, label, description, descriptionId, disabled = false, controlPosition = "start", slot, className, labelClassName }: LabeledControlProps) {
  const box = <span className="flex h-5 shrink-0 items-center">{control}</span>;
  return (
    <div data-slot={slot} data-disabled={disabled || undefined} className={cn("flex items-start gap-2.5", controlPosition === "end" && "w-full justify-between gap-4", className)}>
      {controlPosition === "start" && box}
      <div className="flex min-w-0 flex-col gap-0.5">
        {label && (
          <Label htmlFor={controlId} disabled={disabled} className={cn("font-normal", !disabled && "cursor-pointer", labelClassName)}>
            {label}
          </Label>
        )}
        {description && (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {controlPosition === "end" && box}
    </div>
  );
}
