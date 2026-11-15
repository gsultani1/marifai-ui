// packages/ai-ui/src/hooks/use-submit-status.ts
import { useCallback, useEffect, useRef, useState } from "react";

export type SubmitStatus = "idle" | "pending" | "success" | "error";

export interface SubmitStatusApi<T> {
  status: SubmitStatus;
  /** What the handler threw or rejected with, while `status` is "error". */
  error: unknown;
  /**
   * Runs the handler unless a run is already pending, resolving true on
   * success. Repeat calls during a run (a double click, Enter held down) are
   * ignored and resolve false.
   */
  submit: (value: T) => Promise<boolean>;
  /** Marks a submission as succeeded without running the handler, such as a dropped spam submission. */
  succeed: () => void;
  /** Returns to "idle", such as when the visitor edits the form again. */
  reset: () => void;
}

/** Pending, success and error state for an async form handler, with a guard against double submits. */
export function useSubmitStatus<T>(handler: (value: T) => Promise<void> | void): SubmitStatusApi<T> {
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<unknown>(undefined);
  const pending = useRef(false);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const submit = useCallback(async (value: T) => {
    if (pending.current) return false;
    pending.current = true;
    setStatus("pending");
    setError(undefined);
    try {
      await handlerRef.current(value);
      setStatus("success");
      return true;
    } catch (caught) {
      setError(caught);
      setStatus("error");
      return false;
    } finally {
      pending.current = false;
    }
  }, []);

  const succeed = useCallback(() => {
    if (pending.current) return;
    setError(undefined);
    setStatus("success");
  }, []);

  const reset = useCallback(() => {
    if (pending.current) return;
    setError(undefined);
    setStatus("idle");
  }, []);

  return { status, error, submit, succeed, reset };
}
