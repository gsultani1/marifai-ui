// packages/ai-ui/src/components/separator.tsx
"use client";

import { Separator as BaseSeparator } from "@base-ui/react/separator";
import { type ReactNode, useId } from "react";

import { cn } from "../lib/cn.js";
import type { WithClassName } from "../lib/types.js";

export interface SeparatorProps extends WithClassName<Omit<BaseSeparator.Props, "children">> {
  orientation?: "horizontal" | "vertical";
  /** Text centered on the line, such as "or"; it also names the separator. */
  label?: ReactNode;
}

/**
 * Line between groups of content on Base UI Separator, horizontal or
 * vertical, with an optional centered label that names it.
 */
export function Separator({ orientation = "horizontal", label, className, ...props }: SeparatorProps) {
  const labelId = useId();
  const vertical = orientation === "vertical";
  if (label === undefined || label === null || label === false) {
    return (
      <BaseSeparator
        orientation={orientation}
        data-slot="separator"
        className={cn("shrink-0 bg-border", vertical ? "w-px self-stretch" : "h-px w-full", className)}
        {...props}
      />
    );
  }
  return (
    <BaseSeparator
      orientation={orientation}
      aria-labelledby={labelId}
      data-slot="separator"
      className={cn("flex shrink-0 items-center gap-3", vertical ? "flex-col self-stretch" : "w-full", className)}
      {...props}
    >
      <span aria-hidden="true" className={cn("bg-border", vertical ? "w-px flex-1" : "h-px flex-1")} />
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span aria-hidden="true" className={cn("bg-border", vertical ? "w-px flex-1" : "h-px flex-1")} />
    </BaseSeparator>
  );
}
