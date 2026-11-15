// packages/ai-ui/src/hooks/use-url-readiness.ts
import { useCallback, useEffect, useState } from "react";

export type UrlReadiness = "idle" | "checking" | "ready" | "failed";

export interface UseUrlReadinessOptions {
  enabled?: boolean;
  /** Checks made before reporting "failed". */
  maxAttempts?: number;
  /** Wait before the second check; it doubles after each miss up to `maxDelayMs`. */
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** A check that takes longer than this counts as a miss. */
  timeoutMs?: number;
}

export interface UseUrlReadinessResult {
  status: UrlReadiness;
  /** Checks made so far for the current URL. */
  attempts: number;
  /** Starts checking again from the first attempt. */
  retry: () => void;
}

/** Delay before check `attempt` (1-based): nothing before the first, then doubling from `initial` up to `max`. */
export function readinessDelay(attempt: number, initial: number, max: number): number {
  return attempt <= 1 ? 0 : Math.min(max, initial * 2 ** (attempt - 2));
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/**
 * Waits for a dev server or deployment to answer before a preview loads
 * it: sends HEAD requests (no-cors, so any response counts, including
 * cross-origin ones) with exponential backoff and reports "ready" or, after
 * `maxAttempts`, "failed".
 */
export function useUrlReadiness(url: string | undefined, { enabled = true, maxAttempts = 8, initialDelayMs = 500, maxDelayMs = 8000, timeoutMs = 5000 }: UseUrlReadinessOptions = {}): UseUrlReadinessResult {
  const [run, setRun] = useState(0);
  const key = `${run}:${url ?? ""}`;
  const active = enabled && Boolean(url);
  const [state, setState] = useState<{ key: string; status: UrlReadiness; attempts: number }>({ key: "", status: "idle", attempts: 0 });

  useEffect(() => {
    if (!active || !url) return;
    const controller = new AbortController();
    const check = async () => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await wait(readinessDelay(attempt, initialDelayMs, maxDelayMs), controller.signal);
        const timeout = new AbortController();
        const timer = setTimeout(() => timeout.abort(), timeoutMs);
        const abort = () => timeout.abort();
        controller.signal.addEventListener("abort", abort, { once: true });
        try {
          await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: timeout.signal });
          if (controller.signal.aborted) return;
          setState({ key, status: "ready", attempts: attempt });
          return;
        } catch {
          if (controller.signal.aborted) return;
          setState({ key, status: attempt === maxAttempts ? "failed" : "checking", attempts: attempt });
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", abort);
        }
      }
    };
    check().catch(() => undefined);
    return () => controller.abort();
  }, [active, url, key, maxAttempts, initialDelayMs, maxDelayMs, timeoutMs]);

  const retry = useCallback(() => setRun((value) => value + 1), []);
  const current = state.key === key ? state : { status: active ? ("checking" as const) : ("idle" as const), attempts: 0 };

  return { status: active ? current.status : "idle", attempts: active ? current.attempts : 0, retry };
}
