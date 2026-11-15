// packages/ai-ui/src/hooks/use-auto-fix.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAutoFixOptions {
  /** Current runtime errors; clear the list when new content loads so a repeat error counts as a new attempt. */
  errors: readonly string[];
  /** Asks the agent to fix the errors. */
  onFix: (errors: string[]) => void;
  enabled?: boolean;
  /** Holds off while a fix or other generation is still running. */
  busy?: boolean;
  /** Fixes attempted before giving the decision back to the user. */
  maxAttempts?: number;
  /** Quiet period after the last new error before a fix is requested, so a burst of errors becomes one request. */
  delayMs?: number;
  /** Changing it (e.g. when the user sends a new message) starts the attempt count again. */
  resetKey?: string | number;
}

export interface UseAutoFixResult {
  attempts: number;
  maxAttempts: number;
  /** A fix will be requested once the quiet period passes. */
  scheduled: boolean;
  /** Errors remain and every attempt has been used. */
  exhausted: boolean;
  reset: () => void;
}

/**
 * Requests a fix automatically when a preview reports runtime errors:
 * once per distinct set of errors, after they settle and running work
 * finishes, stopping after `maxAttempts` so a fix that keeps failing hands
 * control back to the user.
 */
export function useAutoFix({ errors, onFix, enabled = true, busy = false, maxAttempts = 3, delayMs = 1500, resetKey = "" }: UseAutoFixOptions): UseAutoFixResult {
  const signature = errors.join("\u0000");
  const [state, setState] = useState({ key: resetKey, attempts: 0, requested: "" });
  if (state.key !== resetKey) setState({ key: resetKey, attempts: 0, requested: "" });
  else if (signature === "" && state.requested !== "") setState({ ...state, requested: "" });
  const current = state.key === resetKey ? state : { key: resetKey, attempts: 0, requested: "" };
  const latest = useRef({ errors, onFix });

  useEffect(() => {
    latest.current = { errors, onFix };
  });

  const scheduled = enabled && !busy && signature !== "" && signature !== current.requested && current.attempts < maxAttempts;

  useEffect(() => {
    if (!scheduled) return;
    const timer = setTimeout(() => {
      setState((previous) => ({ key: previous.key, attempts: previous.attempts + 1, requested: signature }));
      latest.current.onFix([...latest.current.errors]);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [scheduled, signature, delayMs]);

  const reset = useCallback(() => setState((previous) => ({ key: previous.key, attempts: 0, requested: "" })), []);

  return { attempts: current.attempts, maxAttempts, scheduled, exhausted: signature !== "" && current.attempts >= maxAttempts, reset };
}
