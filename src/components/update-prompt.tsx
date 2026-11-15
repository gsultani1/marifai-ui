// packages/ai-ui/src/components/update-prompt.tsx
"use client";

import { CheckCircle2Icon, LoaderCircleIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface UpdatePromptProps {
  /** A new version is waiting, from `useServiceWorkerUpdate` or vite-plugin-pwa's `useRegisterSW`. */
  needRefresh: boolean;
  onRefresh: () => void | Promise<void>;
  /** Hides the prompt until the next update; omit to keep it until the user refreshes. */
  onDismiss?: () => void;
  /** Blocks refreshing while there is unsaved work; a string explains why. */
  blocked?: boolean | string;
  offlineReady?: boolean;
  onDismissOfflineReady?: () => void;
  className?: string;
}

/**
 * New-version notice that never dismisses itself, refreshes only on request,
 * and stays blocked while the page has unsaved work. Also confirms when the
 * app is ready to work offline.
 */
export function UpdatePrompt({ needRefresh, onRefresh, onDismiss, blocked = false, offlineReady = false, onDismissOfflineReady, className }: UpdatePromptProps) {
  const [busy, setBusy] = useState(false);
  if (!needRefresh && !offlineReady) return null;
  const reason = typeof blocked === "string" ? blocked : "Save your changes before updating.";

  if (!needRefresh) {
    return (
      <div role="status" className={cn(card, "flex items-center gap-3 p-3 text-sm", className)}>
        <CheckCircle2Icon aria-hidden="true" className="size-4 shrink-0 text-success" />
        <p className="flex-1">Ready to work offline.</p>
        {onDismissOfflineReady && (
          <button type="button" aria-label="Dismiss" onClick={onDismissOfflineReady} className={cn(iconButton, focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="status" className={cn(card, "flex flex-wrap items-center gap-3 p-3 text-sm", className)}>
      <RefreshCwIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-medium">A new version is available.</p>
        {blocked && <p className="text-xs text-muted-foreground">{reason}</p>}
      </div>
      <div className="flex items-center gap-1">
        {onDismiss && (
          <button type="button" onClick={onDismiss} className={cn(button, buttonVariants.ghost, focusRing)}>
            Later
          </button>
        )}
        <button
          type="button"
          disabled={Boolean(blocked) || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRefresh();
            } finally {
              setBusy(false);
            }
          }}
          className={cn(button, buttonVariants.primary, focusRing)}
        >
          {busy && <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          Refresh
        </button>
      </div>
    </div>
  );
}
