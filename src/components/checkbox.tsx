// packages/ai-ui/src/components/checkbox.tsx
"use client";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { CheckboxGroup as BaseCheckboxGroup } from "@base-ui/react/checkbox-group";
import { CheckIcon, MinusIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { LabeledControl } from "./label.js";

const boxSizes = {
  sm: "size-3.5 [&_svg]:size-3",
  md: "size-4 [&_svg]:size-3.5",
} as const;

export interface CheckboxProps extends Omit<BaseCheckbox.Root.Props, "className" | "children" | "render" | "nativeButton"> {
  /** Visible label; without it pass `aria-label` or wrap the checkbox in a FormField. */
  label?: ReactNode;
  /** Help text under the label, linked with `aria-describedby`. */
  description?: ReactNode;
  size?: keyof typeof boxSizes;
  className?: string;
}

/**
 * Checkbox on Base UI Checkbox with checked, unchecked and indeterminate
 * (`aria-checked="mixed"`) states. Space toggles; the label and description
 * are linked to the control. Inside a CheckboxGroup pass `value`, or `parent`
 * for a "Select all" box that the group drives.
 */
export function Checkbox({ label, description, size = "md", id, disabled, "aria-describedby": describedBy, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? (label ? generatedId : undefined);
  const descriptionId = `${generatedId}-description`;
  const standalone = !label && !description;
  const control = (
    <BaseCheckbox.Root
      id={controlId}
      disabled={disabled}
      nativeButton
      render={<button type="button" />}
      aria-describedby={[describedBy, description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
      data-slot={standalone ? "checkbox" : undefined}
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-muted-foreground bg-background text-primary-foreground transition-colors",
        "data-[checked]:border-primary data-[checked]:bg-primary data-[indeterminate]:border-primary data-[indeterminate]:bg-primary",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[invalid]:border-destructive",
        boxSizes[size],
        focusRing,
        standalone && className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator
        className="flex items-center justify-center data-[unchecked]:hidden"
        render={(indicatorProps, state) => <span {...indicatorProps}>{state.indeterminate ? <MinusIcon aria-hidden="true" strokeWidth={3} /> : <CheckIcon aria-hidden="true" strokeWidth={3} />}</span>}
      />
    </BaseCheckbox.Root>
  );

  if (standalone) return control;
  return <LabeledControl slot="checkbox" control={control} controlId={controlId} label={label} description={description} descriptionId={descriptionId} disabled={disabled} className={className} />;
}

export interface CheckboxGroupOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface CheckboxGroupProps extends Omit<BaseCheckboxGroup.Props, "className" | "children" | "value" | "defaultValue" | "onValueChange" | "render"> {
  /** Renders one Checkbox per option; or pass Checkbox children with a `value` each. */
  options?: CheckboxGroupOption[];
  children?: ReactNode;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Visible group label; inside a FormField the field label names the group instead. */
  label?: ReactNode;
  description?: ReactNode;
  /** Adds a parent checkbox that checks or clears every child and shows mixed when some are checked. Pass a node to rename "Select all". */
  selectAll?: boolean | ReactNode;
  /** Child values the parent controls; defaults to every option value. Required for `selectAll` with Checkbox children. */
  allValues?: string[];
  orientation?: "vertical" | "horizontal";
  size?: keyof typeof boxSizes;
  className?: string;
}

/**
 * Shared state for a set of checkboxes on Base UI CheckboxGroup, with an
 * optional "Select all" parent that turns indeterminate when only some
 * children are checked and skips disabled children when toggling.
 */
export function CheckboxGroup({
  options,
  children,
  value,
  defaultValue = [],
  onValueChange,
  label,
  description,
  selectAll = false,
  allValues,
  orientation = "vertical",
  size = "md",
  className,
  "aria-describedby": describedBy,
  ...props
}: CheckboxGroupProps) {
  const [selected, setSelected] = useControllableState<string[]>({ value, defaultValue, onChange: onValueChange });
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const childValues = allValues ?? options?.map((option) => option.value) ?? [];
  return (
    <BaseCheckboxGroup
      value={selected}
      onValueChange={(next) => setSelected(next)}
      allValues={selectAll ? childValues : undefined}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={[describedBy, description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
      data-slot="checkbox-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    >
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
      {selectAll !== false && <Checkbox parent size={size} label={selectAll === true ? "Select all" : selectAll} />}
      <div className={cn("flex", orientation === "horizontal" ? "flex-row flex-wrap gap-x-6 gap-y-2" : "flex-col gap-2", selectAll !== false && "pl-6")}>
        {options?.map((option) => <Checkbox key={option.value} value={option.value} label={option.label} description={option.description} disabled={option.disabled} size={size} />)}
        {children}
      </div>
    </BaseCheckboxGroup>
  );
}
