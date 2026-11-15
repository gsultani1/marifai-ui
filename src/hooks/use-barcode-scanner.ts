// packages/ai-ui/src/hooks/use-barcode-scanner.ts
import { useEffect, useRef } from "react";

export interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  /** Shortest code accepted. */
  minLength?: number;
  /** Scanners type faster than people; slower gaps start a new buffer. */
  maxInterKeyMs?: number;
  /** Keys a scanner sends after the code. An empty list ends a code after a pause instead. */
  terminators?: string[];
  /** Ignores the same code scanned again within this window. */
  dedupeMs?: number;
  /** Removes the scanned characters from the field that had focus, since scanners type into it. */
  stripFromInputs?: boolean;
  enabled?: boolean;
}

const IDLE_FLUSH_MS = 120;

function stripTrailing(target: EventTarget | null, code: string) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  if (!target.value.endsWith(code)) return;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target) as object, "value")?.set;
  setter?.call(target, target.value.slice(0, -code.length));
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Listens for USB and Bluetooth barcode scanners in keyboard mode: characters
 * that arrive faster than `maxInterKeyMs` and end with Enter or Tab (or a
 * pause) become one scan. The terminator is swallowed so it doesn't submit a
 * form, repeated scans within `dedupeMs` are ignored, and characters that
 * leaked into a focused text input are removed. Keys typed in textareas and
 * rich-text editors are never treated as scans. Enable it only on screens
 * that expect scanning, since very fast typing can look like a scanner.
 */
export function useBarcodeScanner({ onScan, minLength = 4, maxInterKeyMs = 50, terminators = ["Enter", "Tab"], dedupeMs = 300, stripFromInputs = true, enabled = true }: UseBarcodeScannerOptions): void {
  const handler = useRef(onScan);
  const terminatorKey = terminators.join("|");

  useEffect(() => {
    handler.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;
    const ends = terminatorKey ? terminatorKey.split("|") : [];
    let buffer = "";
    let last = 0;
    let target: EventTarget | null = null;
    let lastScan = { code: "", at: 0 };
    let idle: ReturnType<typeof setTimeout> | undefined;

    const emit = () => {
      const code = buffer;
      const from = target;
      buffer = "";
      if (code.length < minLength) return false;
      const now = Date.now();
      if (stripFromInputs) stripTrailing(from, code);
      if (code === lastScan.code && now - lastScan.at < dedupeMs) return true;
      lastScan = { code, at: now };
      handler.current(code);
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element && (element.isContentEditable || element instanceof HTMLTextAreaElement)) {
        buffer = "";
        return;
      }
      const now = Date.now();
      if (now - last > maxInterKeyMs) buffer = "";
      last = now;
      clearTimeout(idle);
      if (ends.includes(event.key)) {
        if (buffer.length >= minLength && emit()) event.preventDefault();
        buffer = "";
        return;
      }
      if (event.key.length !== 1) return;
      if (!buffer) target = event.target;
      buffer += event.key;
      if (ends.length === 0) idle = setTimeout(emit, IDLE_FLUSH_MS);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearTimeout(idle);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled, minLength, maxInterKeyMs, terminatorKey, dedupeMs, stripFromInputs]);
}
