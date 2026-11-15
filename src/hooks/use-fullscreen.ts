// packages/ai-ui/src/hooks/use-fullscreen.ts
import { type RefObject, useCallback, useEffect, useState } from "react";

export interface UseFullscreenResult {
  fullscreen: boolean;
  /** Fullscreen is simulated by covering the viewport because the browser refused or lacks the Fullscreen API. */
  fallback: boolean;
  toggle: () => void;
}

/**
 * Puts an element in browser fullscreen, falling back to covering the
 * viewport (style it while `fallback` is true) when that is refused;
 * Escape leaves either mode.
 */
export function useFullscreen<T extends HTMLElement>(ref: RefObject<T | null>): UseFullscreenResult {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(ref.current !== null && document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  useEffect(() => {
    if (!fallback) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFallback(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fallback]);

  const toggle = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    if (fallback) setFallback(false);
    else if (document.fullscreenElement === element) void document.exitFullscreen?.();
    else if (element.requestFullscreen) element.requestFullscreen().catch(() => setFallback(true));
    else setFallback(true);
  }, [ref, fallback]);

  return { fullscreen: native || fallback, fallback, toggle };
}
