// packages/ai-ui/src/components/suggestion.tsx
import type { ComponentProps, ReactNode } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export function Suggestions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      aria-label="Suggestions"
      data-slot="suggestions"
      className={cn("flex flex-wrap items-start gap-2", className)}
      {...props}
    />
  );
}

export interface SuggestionProps extends Omit<ComponentProps<"button">, "onSelect"> {
  /** Prompt text passed to `onSelect`; also the label when no children are given. */
  suggestion: string;
  onSelect?: (suggestion: string) => void;
  /** Renders the suggestion as a card with a secondary line. */
  description?: ReactNode;
  icon?: ReactNode;
}

export function Suggestion({
  suggestion,
  onSelect,
  description,
  icon,
  className,
  children,
  onClick,
  ...props
}: SuggestionProps) {
  const card = description !== undefined;
  return (
    <button
      type="button"
      data-slot="suggestion"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelect?.(suggestion);
      }}
      className={cn(
        "inline-flex items-center gap-2 border border-border bg-background text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        card ? "items-start rounded-xl px-4 py-3 text-left" : "rounded-full px-3.5 py-1.5",
        focusRing,
        className,
      )}
      {...props}
    >
      {icon}
      {card ? (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{children ?? suggestion}</span>
          <span className="text-muted-foreground">{description}</span>
        </span>
      ) : (
        (children ?? suggestion)
      )}
    </button>
  );
}
