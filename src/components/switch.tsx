// packages/ai-ui/src/components/switch.tsx
"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { type ReactNode, useId } from "react";

import { focusRing, switchRoot, switchThumb } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { LabeledControl } from "./label.js";

const sizes = {
  sm: { root: "h-4 w-7", thumb: "size-3 data-[checked]:translate-x-3" },
  md: { root: "", thumb: "" },
} as const;

export interface SwitchProps extends Omit<BaseSwitch.Root.Props, "className" | "children" | "render" | "nativeButton"> {
  /** Visible label; without it pass `aria-label` or wrap the switch in a FormField. */
  label?: ReactNode;
  /** Help text under the label, linked with `aria-describedby`. */
  description?: ReactNode;
  size?: keyof typeof sizes;
  /** "end" puts the switch after the text and stretches the row, as in settings lists. */
  switchPosition?: "start" | "end";
  className?: string;
}

/**
 * On/off switch on Base UI Switch: Space toggles, the label and description
 * are linked to the control, and inside a FormField the field label names it.
 */
export function Switch({ label, description, size = "md", switchPosition = "start", id, disabled, "aria-describedby": describedBy, className, ...props }: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? (label ? generatedId : undefined);
  const descriptionId = `${generatedId}-description`;
  const control = (
    <BaseSwitch.Root
      id={controlId}
      disabled={disabled}
      nativeButton
      render={<button type="button" />}
      aria-describedby={[describedBy, description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined}
      data-slot={label || description ? undefined : "switch"}
      className={cn(switchRoot, sizes[size].root, "cursor-pointer data-[disabled]:cursor-not-allowed data-[invalid]:ring-1 data-[invalid]:ring-destructive", focusRing, !label && !description && className)}
      {...props}
    >
      <BaseSwitch.Thumb className={cn(switchThumb, sizes[size].thumb)} />
    </BaseSwitch.Root>
  );

  if (!label && !description) return control;
  return (
    <LabeledControl
      slot="switch"
      control={control}
      controlId={controlId}
      label={label}
      description={description}
      descriptionId={descriptionId}
      disabled={disabled}
      controlPosition={switchPosition}
      labelClassName="font-medium"
      className={cn("gap-3", className)}
    />
  );
}
