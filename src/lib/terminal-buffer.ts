// packages/ai-ui/src/lib/terminal-buffer.ts
import { applyCarriageReturns, stripAnsi } from "./ansi.js";

export interface TerminalViewControls {
  focus: () => void;
  fit: () => void;
  clear: () => void;
  /** The xterm.js Terminal instance. */
  terminal: unknown;
}

const TRUNCATED = "\r\n\u001b[2m[earlier output truncated]\u001b[22m\r\n";

/**
 * Holds terminal output until the view can draw it: writes queue up and
 * are drained once per animation frame, queued output is capped while the
 * view is loading or the tab is hidden, and a plain-text copy feeds the
 * fallback shown before xterm.js loads.
 */
export class TerminalBuffer {
  private controls: TerminalViewControls | null = null;
  private pending = "";
  private text = "";
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly maxPending = 2_000_000,
    private readonly maxText = 200_000,
  ) {}

  write(data: string): void {
    if (!data) return;
    this.pending += data;
    if (this.pending.length > this.maxPending) this.pending = TRUNCATED + this.pending.slice(-this.maxPending);
    this.text = (this.text + stripAnsi(data)).replace(/\r\n/g, "\n").split("\n").map(applyCarriageReturns).join("\n").slice(-this.maxText);
    this.emit();
  }

  /** Drains queued output for the view. */
  take(): string {
    const data = this.pending;
    this.pending = "";
    return data;
  }

  clear(): void {
    this.pending = "";
    this.text = "";
    this.controls?.clear();
    this.emit();
  }

  /** The loaded view, or null before xterm.js is ready. */
  get view(): TerminalViewControls | null {
    return this.controls;
  }

  /** Connects the view; returns a function that disconnects it. */
  attach(controls: TerminalViewControls): () => void {
    this.controls = controls;
    return () => {
      if (this.controls === controls) this.controls = null;
    };
  }

  getText = (): string => this.text;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
