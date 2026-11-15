// packages/ai-ui/src/lib/shortcuts.ts
/** One key press of a shortcut, such as mod+shift+k. */
export interface ShortcutStep {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  space: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  plus: "+",
  del: "delete",
  return: "enter",
};

const KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "Enter",
  delete: "Delete",
  backspace: "Backspace",
  tab: "Tab",
};

/** Whether keyboard focus is in a field where typed characters belong to the user. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) return !["button", "checkbox", "radio", "range", "submit", "reset", "color", "file"].includes(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

/** Parses "mod+k", "?" or a two-step sequence such as "g i"; "mod" is Cmd on Apple platforms and Ctrl elsewhere. */
export function parseShortcut(shortcut: string): ShortcutStep[] {
  return shortcut
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((step) => {
      const parts = step.toLowerCase().split("+");
      const raw = parts.length > 1 && parts[parts.length - 1] === "" ? "+" : parts.pop()!;
      const modifiers = new Set(parts.filter(Boolean));
      return { key: KEY_ALIASES[raw] ?? raw, mod: modifiers.has("mod") || modifiers.has("ctrl") || modifiers.has("cmd") || modifiers.has("meta"), shift: modifiers.has("shift"), alt: modifiers.has("alt") || modifiers.has("option") };
    });
}

interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Matches one step. Shift is ignored for symbols such as "?" that need it on some layouts. */
export function matchesStep(event: KeyLike, step: ShortcutStep): boolean {
  if (event.key.toLowerCase() !== step.key) return false;
  if (step.mod !== (event.metaKey || event.ctrlKey)) return false;
  if (step.alt !== event.altKey) return false;
  const symbol = step.key.length === 1 && !/[a-z0-9 ]/.test(step.key);
  return symbol || step.shift === event.shiftKey;
}

/** Display text such as "⌘K", "Ctrl+K" or "G then I". */
export function formatShortcut(shortcut: string, mac = false): string {
  return parseShortcut(shortcut)
    .map((step) => {
      const key = KEY_LABELS[step.key] ?? (step.key.length === 1 ? step.key.toUpperCase() : step.key[0]!.toUpperCase() + step.key.slice(1));
      const mods = [step.mod && (mac ? "⌘" : "Ctrl"), step.alt && (mac ? "⌥" : "Alt"), step.shift && (mac ? "⇧" : "Shift")].filter(Boolean) as string[];
      return mac ? `${mods.join("")}${key}` : [...mods, key].join("+");
    })
    .join(" then ");
}

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}
