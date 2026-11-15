// packages/ai-ui/src/hooks/use-theme.ts
import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";

export interface UseThemeOptions {
  storageKey?: string;
  /** Element that receives data-theme; defaults to the document element. */
  element?: HTMLElement | null;
}

export interface ThemeState {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

const CHANGE_EVENT = "ai-ui-theme-change";
const QUERY = "(prefers-color-scheme: dark)";

function readPreference(key: string): ThemePreference {
  try {
    const value = window.localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function subscribePreference(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

function subscribeSystem(listener: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}

const systemDark = () => window.matchMedia?.(QUERY).matches ?? false;

/**
 * Light, dark or system theme, stored in localStorage, synced across tabs,
 * following the system setting live in "system" mode, and applied as
 * data-theme and color-scheme on the element. Pair with `themeScript` in the
 * document head to avoid a flash before hydration.
 */
export function useTheme({ storageKey = "theme", element }: UseThemeOptions = {}): ThemeState {
  const preference = useSyncExternalStore(subscribePreference, () => readPreference(storageKey), () => "system" as const);
  const dark = useSyncExternalStore(subscribeSystem, systemDark, () => false);
  const resolved = preference === "system" ? (dark ? "dark" : "light") : preference;

  useEffect(() => {
    const target = element === undefined ? document.documentElement : element;
    if (!target) return;
    target.dataset.theme = resolved;
    target.style.colorScheme = resolved;
  }, [element, resolved]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      try {
        if (next === "system") window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, next);
      } catch {
        // The choice then lasts only until reload.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [storageKey],
  );

  return { preference, resolved, setPreference };
}

/** Inline script for the document head that applies the stored theme before first paint. */
export function themeScript(storageKey = "theme"): string {
  const key = JSON.stringify(storageKey);
  return `(function(){try{var p=localStorage.getItem(${key});var d=p==="dark"||(p!=="light"&&matchMedia("${QUERY}").matches);var e=document.documentElement;e.dataset.theme=d?"dark":"light";e.style.colorScheme=d?"dark":"light"}catch(_){}})();`;
}
