// packages/ai-ui/src/hooks/use-copy-to-clipboard.ts
import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "error";

export interface UseCopyToClipboardOptions {
  /** How long "copied" or "error" shows before returning to "idle". */
  resetAfterMs?: number;
  onError?: (error: unknown) => void;
}

export interface UseCopyToClipboardResult {
  status: CopyStatus;
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
}

export function useCopyToClipboard({ resetAfterMs = 2000, onError }: UseCopyToClipboardOptions = {}): UseCopyToClipboardResult {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      let next: CopyStatus = "copied";
      try {
        if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("Clipboard access is unavailable.");
        await navigator.clipboard.writeText(text);
      } catch (error) {
        next = "error";
        onErrorRef.current?.(error);
      }
      clearTimeout(timer.current);
      setStatus(next);
      timer.current = setTimeout(() => setStatus("idle"), resetAfterMs);
      return next === "copied";
    },
    [resetAfterMs],
  );

  return { status, copied: status === "copied", copy };
}
