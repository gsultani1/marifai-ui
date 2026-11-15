// packages/ai-ui/src/lib/log-buffer.ts
import { applyCarriageReturns, stripAnsi } from "./ansi.js";

/** Collapses everything before the last carriage return so redrawn progress lines don't grow without bound. */
function collapseRedraws(text: string): string {
  const last = text.lastIndexOf("\r");
  return last <= 0 ? text : `${applyCarriageReturns(text.slice(0, last))}\r${text.slice(last + 1)}`;
}

export type LogStream = "stdout" | "stderr" | "system" | "command";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogLine {
  id: number;
  /** May contain ANSI escape sequences and carriage returns. */
  text: string;
  stream?: LogStream;
  level?: LogLevel;
  /** Milliseconds since the epoch. */
  timestamp?: number;
  /** The line hasn't ended yet and may still grow. */
  partial?: boolean;
}

export interface LogSnapshot {
  lines: LogLine[];
  /** Lines removed from the start to stay under the cap. */
  dropped: number;
}

export interface LogAppendOptions {
  stream?: LogStream;
  level?: LogLevel;
  timestamp?: number;
}

/** Guesses a level from common log prefixes: "error", "ERR!", "fatal", "warn", "warning", "debug". */
export function detectLogLevel(text: string): LogLevel | undefined {
  const plain = stripAnsi(text);
  if (/\b(?:error|fatal|exception|failed)\b|\berr!/i.test(plain)) return "error";
  if (/\bwarn(?:ing)?\b/i.test(plain)) return "warn";
  if (/^\s*(?:\[?debug\]?|dbg)\b/i.test(plain)) return "debug";
  return undefined;
}

/**
 * Collects streamed output into lines: chunks may split lines anywhere,
 * each stream keeps its own unfinished line, CRLF is normalized and the
 * oldest lines are dropped past `maxLines`.
 */
export class LogBuffer {
  private lines: LogLine[] = [];
  private dropped = 0;
  private nextId = 1;
  private snapshot: LogSnapshot = { lines: [], dropped: 0 };
  private readonly listeners = new Set<() => void>();
  private readonly maxLines: number;

  constructor({ maxLines = 10_000 }: { maxLines?: number } = {}) {
    this.maxLines = maxLines;
  }

  /** Appends raw output that may contain partial lines. */
  append(chunk: string, { stream = "stdout", level, timestamp = Date.now() }: LogAppendOptions = {}): void {
    if (!chunk) return;
    const pieces = chunk.replace(/\r\n/g, "\n").split("\n");
    const lastIndex = this.findPartial(stream);
    if (lastIndex !== -1) {
      const line = this.lines[lastIndex]!;
      const text = collapseRedraws(line.text + pieces.shift()!);
      const detected = level ?? detectLogLevel(text);
      this.lines[lastIndex] = { ...line, text, partial: pieces.length === 0, ...(detected ? { level: detected } : {}) };
    }
    pieces.forEach((text, index) => {
      const isLast = index === pieces.length - 1;
      if (isLast && text === "") return;
      const detected = level ?? detectLogLevel(text);
      this.lines.push({ id: this.nextId++, text, stream, timestamp, ...(detected ? { level: detected } : {}), ...(isLast ? { partial: true } : {}) });
    });
    this.trim();
    this.emit();
  }

  /** Appends one complete line, such as a system message or an echoed command. */
  appendLine(text: string, options: LogAppendOptions = {}): void {
    const { stream = "system", level, timestamp = Date.now() } = options;
    const partial = this.findPartial(stream);
    if (partial !== -1) this.lines[partial] = { ...this.lines[partial]!, partial: false };
    this.lines.push({ id: this.nextId++, text, stream, timestamp, ...(level ? { level } : {}) });
    this.trim();
    this.emit();
  }

  clear(): void {
    this.lines = [];
    this.dropped = 0;
    this.emit();
  }

  getSnapshot = (): LogSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private findPartial(stream: LogStream): number {
    for (let index = this.lines.length - 1; index >= Math.max(0, this.lines.length - 50); index--) {
      const line = this.lines[index]!;
      if (line.stream === stream) return line.partial ? index : -1;
    }
    return -1;
  }

  private trim(): void {
    const excess = this.lines.length - this.maxLines;
    if (excess > 0) {
      this.lines.splice(0, excess);
      this.dropped += excess;
    }
  }

  private emit(): void {
    this.snapshot = { lines: [...this.lines], dropped: this.dropped };
    for (const listener of this.listeners) listener();
  }
}
