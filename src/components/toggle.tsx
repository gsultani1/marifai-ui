// packages/ai-ui/src/components/toggle.tsx
"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { createContext, type ReactNode, use, useMemo } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type ToggleVariant = "outline" | "ghost";
export type ToggleSize = "sm" | "md";

const variants: Record<ToggleVariant, string> = {
  outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground data-[pressed]:bg-accent data-[pressed]:text-accent-foreground",
  ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[pressed]:bg-accent data-[pressed]:text-foreground",
};

const sizes: Record<ToggleSize, { text: string; icon: string }> = {
  sm: { text: "h-8 px-2.5 text-xs", icon: "size-8" },
  md: { text: "h-9 px-3 text-sm", icon: "size-9" },
};

const ToggleGroupContext = createContext<{ variant: ToggleVariant; size: ToggleSize } | null>(null);

export interface ToggleProps extends Omit<BaseToggle.Props, "className"> {
  variant?: ToggleVariant;
  size?: ToggleSize;
  /** Square sizing for a single icon; give the toggle an `aria-label`. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Two-state button on Base UI Toggle (`aria-pressed`), such as Bold or "Show
 * discontinued". Inside a ToggleGroup it takes the group's variant and size.
 * Icon-only toggles need an `aria-label`.
 */
export function Toggle({ variant, size, iconOnly = false, className, ...props }: ToggleProps) {
  const group = use(ToggleGroupContext);
  const resolvedVariant = variant ?? group?.variant ?? "outline";
  const resolvedSize = size ?? group?.size ?? "md";
  return (
    <BaseToggle
      data-slot="toggle"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variants[resolvedVariant],
        iconOnly ? sizes[resolvedSize].icon : sizes[resolvedSize].text,
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export interface ToggleGroupItem<T extends string = string> {
  value: T;
  /** Always required: the visible text, or the accessible name and tooltip when `iconOnly`. */
  label: string;
  icon?: ReactNode;
  /** Hides the label visually; it stays the accessible name. */
  iconOnly?: boolean;
  disabled?: boolean;
}

export interface ToggleGroupProps<T extends string = string> extends Omit<BaseToggleGroup.Props, "className" | "value" | "defaultValue" | "onValueChange"> {
  /** Accessible name of the group, such as "Text formatting". */
  label: string;
  /** Renders one Toggle per item; or pass Toggle children with a `value` each. */
  items?: ToggleGroupItem<T>[];
  /** Pressed values; at most one unless `multiple`. */
  value?: T[];
  defaultValue?: T[];
  onValueChange?: (value: T[]) => void;
  variant?: ToggleVariant;
  size?: ToggleSize;
  className?: string;
}

/**
 * A set of toggles on Base UI ToggleGroup: single choice by default (like
 * text alignment) or `multiple` (like Bold, Italic, Underline). One tab stop;
 * arrow keys move between items. The outline variant joins items into one bar.
 */
export function ToggleGroup<T extends string = string>({ label, items, value, defaultValue, onValueChange, variant = "outline", size = "md", orientation = "horizontal", className, children, ...props }: ToggleGroupProps<T>) {
  const joined = variant === "outline";
  const context = useMemo(() => ({ variant, size }), [variant, size]);
  const isItemValue = (entry: string): entry is T => !items || items.some((item) => item.value === entry);
  return (
    <ToggleGroupContext value={context}>
      <BaseToggleGroup
        aria-label={label}
        data-slot="toggle-group"
        orientation={orientation}
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        onValueChange={(next) => onValueChange?.(next.filter(isItemValue))}
        className={cn(
          "inline-flex w-fit",
          orientation === "vertical" ? "flex-col" : "flex-row",
          joined
            ? orientation === "vertical"
              ? "[&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none"
              : "[&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none"
            : "gap-1",
          "[&>*]:focus-visible:z-10",
          className,
        )}
        {...props}
      >
        {items?.map((item) => (
          <Toggle key={item.value} value={item.value} disabled={item.disabled} iconOnly={item.iconOnly} aria-label={item.iconOnly ? item.label : undefined} title={item.iconOnly ? item.label : undefined}>
            {item.icon}
            {!item.iconOnly && item.label}
          </Toggle>
        ))}
        {children}
      </BaseToggleGroup>
    </ToggleGroupContext>
  );
}
