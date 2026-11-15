// packages/ai-ui/src/hooks/use-lazy-module.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface LazyLoader<T> {
  /** Starts or joins the import. A failed import is retried on the next call. */
  load: () => Promise<T>;
  /** The module once loaded, so later mounts render synchronously. */
  current: () => T | undefined;
}

export function createLazyLoader<T>(importer: () => Promise<T>): LazyLoader<T> {
  let value: T | undefined;
  let pending: Promise<T> | undefined;
  return {
    load: () =>
      (pending ??= importer().then(
        (module) => (value = module),
        (error: unknown) => {
          pending = undefined;
          throw error;
        },
      )),
    current: () => value,
  };
}

export interface UseLazyModuleResult<T> {
  module: T | undefined;
  failed: boolean;
  /** True once the module loaded after a failed attempt. */
  recovered: boolean;
  retry: () => void;
}

export function useLazyModule<T>(loader: LazyLoader<T>, onError?: (error: unknown) => void): UseLazyModuleResult<T> {
  const [module, setModule] = useState(loader.current);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (module) return;
    let cancelled = false;
    loader.load().then(
      (loaded) => {
        if (!cancelled) setModule(() => loaded);
      },
      (error: unknown) => {
        if (cancelled) return;
        setFailed(true);
        onErrorRef.current?.(error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loader, module, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((count) => count + 1);
  }, []);

  return { module, failed, recovered: attempt > 0 && module !== undefined, retry };
}
