// packages/ai-ui/src/hooks/use-message-window.ts
import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";

export interface MessageWindowOptions {
  /** Messages shown at first, counted from the newest. */
  initial?: number;
  /** Messages added by each "show earlier". */
  step?: number;
  /** Scroll container; its position is kept when earlier messages are added above. */
  scrollRef?: RefObject<HTMLElement | null>;
}

export interface MessageWindow<T> {
  visible: T[];
  hiddenCount: number;
  showEarlier: () => void;
}

/**
 * Renders only the newest messages of a long thread and reveals earlier
 * ones in steps, keeping the scroll position steady so the message the
 * user was reading does not jump.
 */
export function useMessageWindow<T>(messages: T[], { initial = 50, step = 50, scrollRef }: MessageWindowOptions = {}): MessageWindow<T> {
  const [extra, setExtra] = useState(0);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const count = Math.min(messages.length, initial + extra);

  useLayoutEffect(() => {
    const element = scrollRef?.current;
    const saved = anchor.current;
    if (!element || !saved) return;
    anchor.current = null;
    element.scrollTop = saved.top + (element.scrollHeight - saved.height);
  }, [count, scrollRef]);

  const showEarlier = useCallback(() => {
    const element = scrollRef?.current;
    if (element) anchor.current = { height: element.scrollHeight, top: element.scrollTop };
    setExtra((value) => value + step);
  }, [scrollRef, step]);

  return { visible: messages.slice(messages.length - count), hiddenCount: messages.length - count, showEarlier };
}
