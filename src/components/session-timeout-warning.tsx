// packages/ai-ui/src/components/session-timeout-warning.tsx
"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing, modalBackdrop, modalPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export interface SessionTimeoutWarningProps {
  /** When the session ends, in epoch milliseconds. */
  expiresAt: number;
  /** How long before expiry the warning opens. Defaults to 5 minutes. */
  warnBeforeMs?: number;
  /** Renews the session; update `expiresAt` afterwards. */
  onExtend: () => void | Promise<void>;
  onSignOut: () => void;
  /** Called once when the time runs out without an extension. */
  onExpire?: () => void;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Warning dialog before an idle session ends, with a live countdown, "Stay
 * signed in" (focused first) and "Sign out". Screen readers hear the time
 * when the dialog opens and at each remaining minute, not every second.
 */
export function SessionTimeoutWarning({ expiresAt, warnBeforeMs = 5 * 60 * 1000, onExtend, onSignOut, onExpire }: SessionTimeoutWarningProps) {
  const now = useNow(1000);
  const remaining = expiresAt - now;
  const open = remaining <= warnBeforeMs && remaining > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const container = usePortalContainer();
  const stayRef = useRef<HTMLButtonElement>(null);
  const expiredFor = useRef<number | null>(null);
  const minutes = Math.ceil(remaining / 60_000);

  useEffect(() => {
    if (remaining > 0 || expiredFor.current === expiresAt) return;
    expiredFor.current = expiresAt;
    onExpire?.();
  }, [remaining, expiresAt, onExpire]);

  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal container={container}>
        <AlertDialog.Backdrop className={modalBackdrop} />
        <AlertDialog.Popup initialFocus={stayRef} className={modalPopup}>
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-base font-semibold">Are you still there?</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              For your security you'll be signed out in <span className="font-semibold text-foreground tabular-nums">{formatCountdown(remaining)}</span>.
            </AlertDialog.Description>
            <p role="status" className="sr-only">
              {open ? `${minutes} ${minutes === 1 ? "minute" : "minutes"} left before sign out` : ""}
            </p>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onSignOut} className={cn(button, buttonVariants.outline, focusRing)}>
              Sign out
            </button>
            <button
              ref={stayRef}
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onExtend();
                } catch {
                  setError("Couldn't extend your session. Save your work and sign in again.");
                } finally {
                  setBusy(false);
                }
              }}
              className={cn(button, buttonVariants.primary, focusRing)}
            >
              {busy && <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
              Stay signed in
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
