// packages/ai-ui/src/components/preview-error-banner.tsx
"use client";

import { ChevronDownIcon, CopyIcon, LoaderCircleIcon, SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface PreviewErrorBannerProps {
  errors: readonly string[];
  /** Shown as "Fix it"; receives every error. */
  onFix?: (errors: string[]) => void;
  onDismiss?: () => void;
  /** A fix is being written. */
  fixing?: boolean;
  /** Extra status such as "Auto-fix attempt 2 of 3". */
  note?: ReactNode;
  className?: string;
}

/**
 * Runtime errors reported by a running preview: the first lines of each,
 * the full text on request with copy, and "Fix it" to hand them to the
 * agent.
 */
export function PreviewErrorBanner({ errors, onFix, onDismiss, fixing = false, note, className }: PreviewErrorBannerProps) {
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const id = useId();
  if (errors.length === 0) return null;
  const heading = `The preview hit ${errors.length === 1 ? "an error" : `${errors.length} errors`}`;

  return (
    <div role="alert" data-slot="preview-error-banner" className={cn("flex flex-col gap-1.5 border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-sm", className)}>
      <div className="flex flex-wrap items-start gap-2">
        <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-medium">{heading}</p>
          {!open &&
            errors.map((message, index) => (
              <p key={index} className="truncate font-mono text-xs">
                {message}
              </p>
            ))}
          {note && <p className="text-xs">{note}</p>}
        </div>
        <button type="button" aria-expanded={open} aria-controls={`${id}-details`} onClick={() => setOpen(!open)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs text-foreground", focusRing)}>
          Details
          <ChevronDownIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        {onFix && (
          <button type="button" disabled={fixing} onClick={() => onFix([...errors])} className={cn(button, buttonVariants.primary, "h-7", focusRing)}>
            {fixing ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <SparklesIcon aria-hidden="true" />}
            {fixing ? "Fixing…" : "Fix it"}
          </button>
        )}
        {onDismiss && (
          <button type="button" aria-label="Dismiss errors" title="Dismiss" onClick={onDismiss} className={cn(iconButton, "size-7", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <div id={`${id}-details`} className="relative">
          <pre tabIndex={0} aria-label="Error details" className={cn("max-h-48 overflow-auto rounded-md border border-border bg-background p-2 pr-10 font-mono text-xs whitespace-pre-wrap", focusRing)}>
            {errors.join("\n\n")}
          </pre>
          <button type="button" aria-label={copied ? "Copied" : "Copy errors"} title="Copy errors" onClick={() => void copy(errors.join("\n\n"))} className={cn(iconButton, "absolute top-1 right-1 size-7", focusRing)}>
            <CopyIcon aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
