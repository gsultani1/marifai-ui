// packages/ai-ui/src/components/terminal.tsx
"use client";

import { type Ref, useImperativeHandle, useState, useSyncExternalStore } from "react";

import { createLazyLoader, useLazyModule } from "../hooks/use-lazy-module.js";
import { cn } from "../lib/cn.js";
import { TerminalBuffer } from "../lib/terminal-buffer.js";
import { EditorFallback } from "./editor-fallback.js";

export interface TerminalHandle {
  /** Writes output, which may contain ANSI escape sequences; queued until the terminal loads. */
  write: (data: string) => void;
  writeln: (line: string) => void;
  clear: () => void;
  focus: () => void;
  /** Recomputes columns and rows for the current size. */
  fit: () => void;
  /** The xterm.js Terminal, or null until loaded. */
  getTerminal: () => unknown;
}

export interface TerminalProps {
  /** Keystrokes and pastes typed by the user; without it the terminal is read-only. */
  onData?: (data: string) => void;
  onResize?: (size: { cols: number; rows: number }) => void;
  /** Ignores typing even when `onData` is set. */
  readOnly?: boolean;
  /** Output written once on mount. */
  initialContent?: string;
  /** Lines kept above the screen. */
  scrollback?: number;
  fontSize?: number;
  /** xterm.js accessibility tree that screen readers can browse and that announces output. */
  screenReaderMode?: boolean;
  "aria-label"?: string;
  className?: string;
  ref?: Ref<TerminalHandle>;
  onLoadError?: (error: unknown) => void;
}

const terminalView = createLazyLoader(() => import("./terminal-view.js"));

/** Starts downloading xterm.js ahead of first render. */
export function preloadTerminal(): Promise<void> {
  return terminalView.load().then(
    () => undefined,
    () => undefined,
  );
}

function TerminalFallback({ buffer, label }: { buffer: TerminalBuffer; label: string }) {
  const text = useSyncExternalStore(buffer.subscribe, buffer.getText, () => "");
  return (
    <pre tabIndex={0} aria-label={label} className="min-h-full overflow-auto p-3 font-mono text-xs leading-5 whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
      {text}
    </pre>
  );
}

/**
 * Terminal built on xterm.js, which loads on first render. Output written
 * through the handle is batched per animation frame and capped while the
 * view loads or the tab is hidden; the size follows the container and the
 * colors follow the theme.
 */
export function Terminal({ ref, initialContent, onLoadError, className, "aria-label": label = "Terminal", ...props }: TerminalProps) {
  const [buffer] = useState(() => {
    const created = new TerminalBuffer();
    if (initialContent) created.write(initialContent);
    return created;
  });
  const { module, failed, retry } = useLazyModule(terminalView, onLoadError);

  useImperativeHandle(
    ref,
    () => ({
      write: (data) => buffer.write(data),
      writeln: (line) => buffer.write(`${line}\r\n`),
      clear: () => buffer.clear(),
      focus: () => buffer.view?.focus(),
      fit: () => buffer.view?.fit(),
      getTerminal: () => buffer.view?.terminal ?? null,
    }),
    [buffer],
  );

  const frame = cn("relative min-h-32 overflow-hidden rounded-lg border border-border bg-code-background text-code-foreground", className);
  if (module) return <module.TerminalView buffer={buffer} label={label} className={frame} {...props} />;
  return (
    <EditorFallback slot="terminal" failed={failed} onRetry={retry} className={frame}>
      <TerminalFallback buffer={buffer} label={label} />
    </EditorFallback>
  );
}
