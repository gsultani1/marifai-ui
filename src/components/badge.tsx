// packages/ai-ui/src/components/badge.tsx
"use client";

import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { badge, focusRing, type Tone, toneDot, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | Tone;

const VARIANT_CLASSES: Record<"default" | "secondary" | "outline" | "destructive", string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "bg-background text-foreground",
  destructive: "border-transparent bg-destructive text-background",
};

const DOT_CLASSES: Record<"default" | "secondary" | "outline" | "destructive", string> = {
  default: "bg-primary-foreground",
  secondary: "bg-secondary-foreground",
  outline: "bg-foreground",
  destructive: "bg-background",
};

function isTone(variant: BadgeVariant): variant is Tone {
  return variant in toneSurface;
}

export interface BadgeProps extends ComponentProps<"span"> {
  /** A solid style or one of the shared tones (neutral, info, success, warning, danger). */
  variant?: BadgeVariant;
  /** Leading status dot in the variant's color. */
  dot?: boolean;
  /** Shows a remove button; pair with `removeLabel`. */
  onRemove?: () => void;
  /** Accessible name of the remove button, such as "Remove Plumbing filter". Defaults to "Remove". */
  removeLabel?: string;
}

/**
 * Small label for status, counts and filters. Tone variants keep the text at
 * full contrast and carry the color in the tint and dot; `onRemove` adds a
 * labeled remove button for filter chips.
 */
export function Badge({ variant = "default", dot = false, onRemove, removeLabel = "Remove", className, children, ...props }: BadgeProps) {
  const tone = isTone(variant);
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badge, tone ? cn(toneSurface[variant], "text-foreground") : VARIANT_CLASSES[variant], onRemove && "pr-0.5", className)}
      {...props}
    >
      {dot && <span aria-hidden="true" data-slot="badge-dot" className={cn("size-1.5 shrink-0 rounded-full", tone ? toneDot[variant] : DOT_CLASSES[variant])} />}
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          data-slot="badge-remove"
          className={cn("-my-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-offset-0 before:absolute before:-inset-1.5 relative", focusRing)}
        >
          <XIcon aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
