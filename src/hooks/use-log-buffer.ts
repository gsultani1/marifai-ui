// packages/ai-ui/src/hooks/use-log-buffer.ts
import { useState, useSyncExternalStore } from "react";

import { type LogAppendOptions, LogBuffer, type LogLine } from "../lib/log-buffer.js";

export interface LogBufferState {
  lines: LogLine[];
  dropped: number;
  /** Appends raw output; lines may be split across chunks. */
  append: (chunk: string, options?: LogAppendOptions) => void;
  appendLine: (text: string, options?: LogAppendOptions) => void;
  clear: () => void;
}

const EMPTY = { lines: [], dropped: 0 };

/** Streamed output as lines for LogViewer, capped at `maxLines`. */
export function useLogBuffer({ maxLines }: { maxLines?: number } = {}): LogBufferState {
  const [buffer] = useState(() => new LogBuffer(maxLines === undefined ? {} : { maxLines }));
  const snapshot = useSyncExternalStore(buffer.subscribe, buffer.getSnapshot, () => EMPTY);
  const [actions] = useState(() => ({
    append: (chunk: string, options?: LogAppendOptions) => buffer.append(chunk, options),
    appendLine: (text: string, options?: LogAppendOptions) => buffer.appendLine(text, options),
    clear: () => buffer.clear(),
  }));
  return { lines: snapshot.lines, dropped: snapshot.dropped, ...actions };
}
