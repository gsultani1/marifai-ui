// packages/ai-ui/src/hooks/use-draft-store.ts
import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "ai-ui-draft-change";

export function readDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves a draft, or removes it when empty, and notifies every tab and hook reading the key. */
export function writeDraft(key: string, value: string): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Without storage the draft lasts until reload.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

/** The saved draft for a key (one per conversation, for example), or null; null during server render. */
export function useStoredDraft(key: string | undefined): string | null {
  return useSyncExternalStore(subscribe, () => (key ? readDraft(key) : null), () => null);
}
