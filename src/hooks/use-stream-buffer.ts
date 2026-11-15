// packages/ai-ui/src/hooks/use-stream-buffer.ts
import { useCallback, useEffect, useRef } from "react";

export interface UseStreamBufferOptions<T> {
  /** Receives every chunk queued since the last flush, at most once per animation frame. */
  onFlush: (chunks: T[]) => void;
  /** Delay used instead of animation frames while the tab is hidden. */
  hiddenDelayMs?: number;
}

export interface UseStreamBufferResult<T> {
  /**
   * Queues a chunk. When `sequence` is given, chunks at or below the last
   * accepted sequence are dropped as duplicates or out-of-order replays.
   */
  push: (chunk: T, sequence?: number) => void;
  /** Delivers queued chunks now, e.g. when the stream ends. */
  flush: () => void;
  /** Drops queued chunks and forgets the last sequence, e.g. for a new stream. */
  reset: () => void;
}

/**
 * Coalesces fast token streams so React renders at most once per frame, and
 * keeps working in background tabs where animation frames pause.
 */
export function useStreamBuffer<T>({ onFlush, hiddenDelayMs = 16 }: UseStreamBufferOptions<T>): UseStreamBufferResult<T> {
  const queue = useRef<T[]>([]);
  const lastSequence = useRef(-Infinity);
  const scheduled = useRef<{ cancel: () => void } | null>(null);
  const onFlushRef = useRef(onFlush);

  useEffect(() => {
    onFlushRef.current = onFlush;
  }, [onFlush]);

  const flush = useCallback(() => {
    scheduled.current?.cancel();
    scheduled.current = null;
    if (queue.current.length === 0) return;
    const chunks = queue.current;
    queue.current = [];
    onFlushRef.current(chunks);
  }, []);

  const schedule = useCallback(() => {
    if (scheduled.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      const timer = setTimeout(flush, hiddenDelayMs);
      scheduled.current = { cancel: () => clearTimeout(timer) };
      return;
    }
    const frame = requestAnimationFrame(flush);
    scheduled.current = { cancel: () => cancelAnimationFrame(frame) };
  }, [flush, hiddenDelayMs]);

  const push = useCallback(
    (chunk: T, sequence?: number) => {
      if (sequence !== undefined) {
        if (sequence <= lastSequence.current) return;
        lastSequence.current = sequence;
      }
      queue.current.push(chunk);
      schedule();
    },
    [schedule],
  );

  const reset = useCallback(() => {
    scheduled.current?.cancel();
    scheduled.current = null;
    queue.current = [];
    lastSequence.current = -Infinity;
  }, []);

  useEffect(() => () => scheduled.current?.cancel(), []);

  return { push, flush, reset };
}
