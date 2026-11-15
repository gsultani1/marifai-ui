// packages/ai-ui/src/hooks/use-notification-polling.ts
import { useEffect, useRef } from "react";

export interface UseNotificationPollingOptions {
  /** The notification panel is open, so updates matter more. */
  open?: boolean;
  openIntervalMs?: number;
  closedIntervalMs?: number;
  enabled?: boolean;
}

/**
 * Polls for notifications: often while the panel is open, rarely while it
 * is closed, never while the tab is hidden, and at once when the tab comes
 * back into view or the window regains focus. Each poll can be aborted.
 */
export function useNotificationPolling(poll: (signal: AbortSignal) => void | Promise<void>, { open = false, openIntervalMs = 15_000, closedIntervalMs = 60_000, enabled = true }: UseNotificationPollingOptions = {}): void {
  const latest = useRef(poll);

  useEffect(() => {
    latest.current = poll;
  });

  useEffect(() => {
    if (!enabled) return;
    let controller: AbortController | null = null;
    const run = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      Promise.resolve(latest.current(controller.signal)).catch(() => undefined);
    };
    const timer = setInterval(run, open ? openIntervalMs : closedIntervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", run);
    if (open) run();
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", run);
      controller?.abort();
    };
  }, [enabled, open, openIntervalMs, closedIntervalMs]);
}
