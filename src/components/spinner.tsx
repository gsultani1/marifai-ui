// packages/ai-ui/src/components/spinner.tsx
import { LoaderCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";

export type SpinnerSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
};

export interface SpinnerProps extends Omit<ComponentProps<"span">, "children"> {
  /** What is loading, announced politely; defaults to "Loading". */
  label?: string;
  /** Shows the label next to the spinner instead of only to screen readers. */
  showLabel?: boolean;
  size?: SpinnerSize;
}

/**
 * Indeterminate loading indicator with a status role. It spins only when
 * motion is allowed and pulses gently under reduced motion.
 */
export function Spinner({ label = "Loading", showLabel = false, size = "md", className, ...props }: SpinnerProps) {
  return (
    <span role="status" data-slot="spinner" className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)} {...props}>
      <LoaderCircleIcon aria-hidden="true" className={cn("shrink-0 motion-safe:animate-spin motion-reduce:animate-pulse", SIZE_CLASSES[size])} />
      <span className={cn(!showLabel && "sr-only")}>{label}</span>
    </span>
  );
}
