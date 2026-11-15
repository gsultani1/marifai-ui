// packages/ai-ui/src/components/radio-group.tsx
"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { type ReactNode, useId } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { LabeledControl } from "./label.js";

export interface RadioOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  /** Leading icon in the card variant. */
  icon?: ReactNode;
  /** Trailing detail in the card variant, such as a price or delivery time. */
  aside?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string = string> extends Omit<BaseRadioGroup.Props<T>, "className" | "children" | "value" | "defaultValue" | "onValueChange" | "render"> {
  /** Renders one item per option; or pass RadioGroupItem or RadioCard children. */
  options?: RadioOption<T>[];
  children?: ReactNode;
  value?: T | null;
  defaultValue?: T | null;
  onValueChange?: (value: T) => void;
  /** Visible group label; inside a FormField the field label names the group instead. */
  label?: ReactNode;
  description?: ReactNode;
  /** "card" renders options as RadioCard tiles. */
  variant?: "default" | "card";
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * One choice from a list on Base UI RadioGroup: a single tab stop, arrow keys
 * move focus and selection, and the label and description name the group.
 */
export function RadioGroup<T extends string = string>({
  options,
  children,
  value,
  defaultValue = null,
  onValueChange,
  label,
  description,
  variant = "default",
  orientation = "vertical",
  className,
  "aria-describedby": describedBy,
  ...props
}: RadioGroupProps<T>) {
  const [selected, setSelected] = useControllableState<T | null>({ value, defaultValue, onChange: (next) => next !== null && onValueChange?.(next) });
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const cards = variant === "card";
  return (
    <div data-slot="radio-group" className={cn("flex min-w-0 flex-col gap-2", className)}>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <div id={labelId} className="text-sm font-medium text-foreground">
              {label}
            </div>
          )}
          {description && (
            <p id={descriptionId} className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      <BaseRadioGroup<T | null>
        value={selected}
        onValueChange={(next) => setSelected(next)}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={[describedBy, description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
        className={cn(
          "flex",
          cards ? (orientation === "horizontal" ? "grid gap-3 sm:grid-flow-col sm:auto-cols-fr" : "flex-col gap-3") : orientation === "horizontal" ? "flex-row flex-wrap gap-x-6 gap-y-2" : "flex-col gap-2",
        )}
        {...props}
      >
        {options?.map((option) =>
          cards ? (
            <RadioCard key={option.value} value={option.value} label={option.label} description={option.description} icon={option.icon} aside={option.aside} disabled={option.disabled} />
          ) : (
            <RadioGroupItem key={option.value} value={option.value} label={option.label} description={option.description} disabled={option.disabled} />
          ),
        )}
        {children}
      </BaseRadioGroup>
    </div>
  );
}

export interface RadioGroupItemProps extends Omit<Radio.Root.Props, "className" | "children" | "render" | "nativeButton"> {
  /** Visible label; without it pass `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
}

const radioCircle =
  "flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground bg-background transition-colors data-[checked]:border-primary data-[disabled]:opacity-50 data-[invalid]:border-destructive";

const radioDot = <Radio.Indicator className="size-2 rounded-full bg-primary data-[unchecked]:hidden" />;

/** A radio button with its label and description, for use inside RadioGroup. */
export function RadioGroupItem({ label, description, id, disabled, "aria-describedby": describedBy, className, ...props }: RadioGroupItemProps) {
  const generatedId = useId();
  const controlId = id ?? (label ? generatedId : undefined);
  const descriptionId = `${generatedId}-description`;
  const standalone = !label && !description;
  const control = (
    <Radio.Root
      id={controlId}
      disabled={disabled}
      nativeButton
      render={<button type="button" />}
      aria-describedby={[describedBy, description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
      data-slot={standalone ? "radio" : undefined}
      className={cn(radioCircle, "cursor-pointer data-[disabled]:cursor-not-allowed", focusRing, standalone && className)}
      {...props}
    >
      {radioDot}
    </Radio.Root>
  );
  if (standalone) return control;
  return <LabeledControl slot="radio" control={control} controlId={controlId} label={label} description={description} descriptionId={descriptionId} disabled={disabled} className={className} />;
}

export interface RadioCardProps extends Omit<Radio.Root.Props, "className" | "children" | "render" | "nativeButton"> {
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Trailing detail such as a price ("$7.99") or lead time. */
  aside?: ReactNode;
  className?: string;
}

/**
 * A selectable tile for plan or shipping choices inside RadioGroup. The whole
 * card is the radio: it is named by its label and described by the rest.
 */
export function RadioCard({ label, description, icon, aside, disabled, className, ...props }: RadioCardProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const asideId = `${id}-aside`;
  const describedBy = [description ? descriptionId : undefined, aside ? asideId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <Radio.Root
      disabled={disabled}
      nativeButton
      render={<button type="button" />}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      data-slot="radio-card"
      className={cn(
        "group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-accent/40",
        "data-[checked]:border-primary data-[checked]:ring-1 data-[checked]:ring-primary data-[disabled]:cursor-not-allowed data-[disabled]:bg-muted/40 data-[disabled]:hover:bg-muted/40",
        focusRing,
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn(radioCircle, "mt-0.5 group-data-[checked]:border-primary")}>
        <span className="size-2 rounded-full bg-primary opacity-0 group-data-[checked]:opacity-100" />
      </span>
      {icon && <span className="mt-0.5 flex shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={labelId} className={cn("text-sm font-medium", disabled ? "text-muted-foreground" : "text-foreground")}>
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {aside && (
        <span id={asideId} className="shrink-0 text-sm font-medium text-foreground tabular-nums">
          {aside}
        </span>
      )}
    </Radio.Root>
  );
}
