// packages/ai-ui/src/hooks/use-form-draft.ts
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface UseFormDraftOptions<T extends Record<string, unknown>> {
  /** Storage key; include the form and record, such as "draft:invoice:42". */
  key: string;
  value: T;
  /** Field names never stored, in addition to password, secret, token and card fields. */
  exclude?: string[];
  debounceMs?: number;
  /** Drafts older than this are ignored. Defaults to 7 days. */
  maxAgeMs?: number;
  enabled?: boolean;
}

export interface FormDraftState<T> {
  /** The draft saved by an earlier visit, until the form changes or the draft is cleared. */
  draft: Partial<T> | null;
  savedAt: number | null;
  /** Removes the stored draft, such as after a successful submit. */
  clear: () => void;
  /** Writes the current value at once. */
  flush: () => void;
}

interface StoredDraft {
  version: 1;
  savedAt: number;
  value: Record<string, unknown>;
}

const SENSITIVE = /pass(word|code|phrase)?|secret|token|otp|pin$|card|cvv|cvc|ssn|iban/i;
const WEEK = 7 * 24 * 60 * 60 * 1000;
const noopSubscribe = () => () => undefined;

function isFileLike(value: unknown): boolean {
  return (typeof Blob !== "undefined" && value instanceof Blob) || (typeof FileList !== "undefined" && value instanceof FileList);
}

/** Copy of the form value without sensitive fields, files or functions. */
export function sanitizeDraft(value: Record<string, unknown>, exclude: string[] = []): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(value)) {
    if (exclude.includes(name) || SENSITIVE.test(name) || isFileLike(field) || typeof field === "function") continue;
    if (Array.isArray(field) && field.some(isFileLike)) continue;
    result[name] = field;
  }
  return result;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse(raw: string | null, maxAgeMs: number, now: number): StoredDraft | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredDraft;
    if (stored?.version !== 1 || typeof stored.savedAt !== "number" || typeof stored.value !== "object" || stored.value === null) return null;
    return now - stored.savedAt > maxAgeMs ? null : stored;
  } catch {
    return null;
  }
}

/**
 * Keeps an unsent form in localStorage: saves after typing pauses (300 ms by
 * default) and when the page is hidden or closed, never stores passwords,
 * secrets, card fields or files, and offers the previous draft back until the
 * user changes the form. Nothing is written until the form differs from how
 * it first rendered, so opening a form never overwrites an older draft.
 */
export function useFormDraft<T extends Record<string, unknown>>({ key, value, exclude = [], debounceMs = 300, maxAgeMs = WEEK, enabled = true }: UseFormDraftOptions<T>): FormDraftState<T> {
  const serialized = JSON.stringify(sanitizeDraft(value, exclude));
  const [initial] = useState(serialized);
  const [cleared, setCleared] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const raw = useSyncExternalStore(noopSubscribe, () => readRaw(key), () => null);
  const changed = serialized !== initial;
  const latest = useRef(serialized);
  const dirty = useRef(false);

  const write = useCallback(() => {
    if (!dirty.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), value: JSON.parse(latest.current) as Record<string, unknown> } satisfies StoredDraft));
      dirty.current = false;
    } catch {
      // Storage can be full or blocked; the form keeps working without drafts.
    }
  }, [key]);

  useEffect(() => {
    latest.current = serialized;
    if (!enabled || !changed) return;
    dirty.current = true;
    const timer = setTimeout(write, debounceMs);
    return () => clearTimeout(timer);
  }, [serialized, changed, enabled, debounceMs, write]);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") write();
    };
    window.addEventListener("pagehide", write);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", write);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [enabled, write]);

  const clear = useCallback(() => {
    dirty.current = false;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove when storage is unavailable.
    }
    setCleared(true);
  }, [key]);

  const flush = useCallback(() => {
    if (!enabled) return;
    dirty.current = true;
    write();
  }, [enabled, write]);

  const parsed = changed || cleared ? null : parse(raw, maxAgeMs, openedAt);
  const stored = parsed && JSON.stringify(parsed.value) !== serialized ? parsed : null;
  return { draft: (stored?.value as Partial<T> | undefined) ?? null, savedAt: stored?.savedAt ?? null, clear, flush };
}
