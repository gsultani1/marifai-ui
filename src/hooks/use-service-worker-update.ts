// packages/ai-ui/src/hooks/use-service-worker-update.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface ServiceWorkerUpdateState {
  /** A new version is installed and waiting. */
  needRefresh: boolean;
  /** The app is cached for offline use. */
  offlineReady: boolean;
  /** Activates the waiting worker and reloads once it takes control. */
  update: () => void;
  dismissOfflineReady: () => void;
}

/**
 * Registers a service worker in prompt mode: a new version waits until the
 * user chooses to refresh (the worker must call skipWaiting when it receives
 * `{ type: "SKIP_WAITING" }`). Checks for updates every `checkIntervalMs`.
 */
export function useServiceWorkerUpdate(scriptUrl: string, { scope, checkIntervalMs = 60 * 60 * 1000 }: { scope?: string; checkIntervalMs?: number } = {}): ServiceWorkerUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const watch = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state !== "installed" || cancelled) return;
        if (navigator.serviceWorker.controller) setNeedRefresh(true);
        else setOfflineReady(true);
      });
    };
    navigator.serviceWorker
      .register(scriptUrl, scope ? { scope } : undefined)
      .then((result) => {
        if (cancelled) return;
        registration.current = result;
        if (result.waiting && navigator.serviceWorker.controller) setNeedRefresh(true);
        watch(result.installing);
        result.addEventListener("updatefound", () => watch(result.installing));
        timer = setInterval(() => void result.update().catch(() => undefined), checkIntervalMs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [scriptUrl, scope, checkIntervalMs]);

  const update = useCallback(() => {
    const waiting = registration.current?.waiting;
    if (!waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, []);

  return { needRefresh, offlineReady, update, dismissOfflineReady: () => setOfflineReady(false) };
}
