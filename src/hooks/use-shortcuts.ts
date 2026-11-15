// packages/ai-ui/src/hooks/use-shortcuts.ts
import { useEffect, useRef, useSyncExternalStore } from "react";

import { isApplePlatform, isEditableTarget, matchesStep, parseShortcut, type ShortcutStep } from "../lib/shortcuts.js";

export interface Shortcut {
  id: string;
  /** "mod+k", "?", "shift+n" or a two-step sequence such as "g i". */
  keys: string;
  description: string;
  group?: string;
  handler: (event: KeyboardEvent) => void;
  /** Also fires while typing in a field; use for mod-key shortcuts only. */
  allowInInputs?: boolean;
  enabled?: boolean;
}

export interface RegisteredShortcut extends Omit<Shortcut, "handler"> {
  steps: ShortcutStep[];
}

interface Entry {
  shortcut: () => Shortcut;
  steps: ShortcutStep[];
}

const SEQUENCE_TIMEOUT = 1000;
const entries = new Map<symbol, Entry[]>();
const listeners = new Set<() => void>();
let snapshot: RegisteredShortcut[] = [];
let pending: { entry: Entry; at: number } | null = null;

function rebuild() {
  snapshot = [...entries.values()].flat().flatMap((entry) => {
    const { handler: _handler, ...rest } = entry.shortcut();
    return rest.enabled === false ? [] : [{ ...rest, steps: entry.steps }];
  });
  for (const listener of listeners) listener();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return;
  const editable = isEditableTarget(event.target);
  const all = [...entries.values()].flat();
  const now = Date.now();
  if (pending && now - pending.at <= SEQUENCE_TIMEOUT) {
    const { entry } = pending;
    pending = null;
    const shortcut = entry.shortcut();
    if (matchesStep(event, entry.steps[1]!) && shortcut.enabled !== false) {
      event.preventDefault();
      shortcut.handler(event);
      return;
    }
  }
  pending = null;
  for (const entry of all) {
    const shortcut = entry.shortcut();
    if (shortcut.enabled === false || (editable && !shortcut.allowInInputs)) continue;
    if (!matchesStep(event, entry.steps[0]!)) continue;
    if (entry.steps.length > 1) {
      pending = { entry, at: now };
      return;
    }
    event.preventDefault();
    shortcut.handler(event);
    return;
  }
}

function register(owner: symbol, list: Entry[]) {
  if (entries.size === 0 && typeof window !== "undefined") window.addEventListener("keydown", onKeyDown);
  entries.set(owner, list);
  rebuild();
  return () => {
    entries.delete(owner);
    if (entries.size === 0 && typeof window !== "undefined") window.removeEventListener("keydown", onKeyDown);
    rebuild();
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const EMPTY: RegisteredShortcut[] = [];

/**
 * Registers page-wide keyboard shortcuts for as long as the component is
 * mounted. Shortcuts are skipped while typing in a field unless they opt in,
 * two-step sequences wait one second for the second key, and every
 * registered shortcut appears in `useRegisteredShortcuts` for a help dialog.
 */
export function useShortcuts(shortcuts: Shortcut[]): void {
  const latest = useRef(shortcuts);
  const signature = shortcuts.map((shortcut) => `${shortcut.id}:${shortcut.keys}:${shortcut.description}:${shortcut.group ?? ""}:${shortcut.enabled !== false}:${shortcut.allowInInputs === true}`).join("|");

  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    const owner = Symbol("shortcuts");
    const list = latest.current.map((shortcut, index) => ({ steps: parseShortcut(shortcut.keys), shortcut: () => latest.current[index] ?? shortcut }));
    return register(owner, list);
  }, [signature]);
}

/** Every shortcut registered on the page, for a help dialog. */
export function useRegisteredShortcuts(): RegisteredShortcut[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

const noopSubscribe = () => () => undefined;

/** True on Apple platforms, where "mod" means Cmd; false during server render. */
export function useApplePlatform(): boolean {
  return useSyncExternalStore(noopSubscribe, isApplePlatform, () => false);
}
