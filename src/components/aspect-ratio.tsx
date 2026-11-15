// packages/ai-ui/src/components/aspect-ratio.tsx
import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";

export interface AspectRatioProps extends ComponentProps<"div"> {
  /** Width divided by height, such as 16 / 9; invalid values fall back to 1. */
  ratio?: number;
}

/**
 * Box that keeps a width-to-height ratio as it resizes, for images, video and
 * maps. Give the child `size-full` (and `object-cover` for media).
 */
export function AspectRatio({ ratio = 1, className, style, ...props }: AspectRatioProps) {
  const safe = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return <div data-slot="aspect-ratio" className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: String(safe), ...style }} {...props} />;
}
