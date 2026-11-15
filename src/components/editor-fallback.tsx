// packages/ai-ui/src/components/editor-fallback.tsx
import type { ReactNode } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

interface EditorFallbackProps {
  slot: string;
  failed: boolean;
  onRetry: () => void;
  className?: string | undefined;
  children: ReactNode;
}

/** Placeholder frame shown while an editor chunk loads, or after it failed to load. */
export function EditorFallback({ slot, failed, onRetry, className, children }: EditorFallbackProps) {
  return (
    <div
      data-slot={slot}
      data-state={failed ? "error" : "loading"}
      aria-busy={failed ? undefined : true}
      className={cn("flex flex-col", className)}
    >
      {failed ? (
        <div
          role="alert"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-destructive/10 px-3 py-1.5 text-sm text-destructive"
        >
          <span className="min-w-0 flex-1">The editor could not load. Your text is shown read-only.</span>
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-accent",
              focusRing,
            )}
          >
            Retry editor
          </button>
        </div>
      ) : (
        <span role="status" className="sr-only">
          Loading editor
        </span>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
