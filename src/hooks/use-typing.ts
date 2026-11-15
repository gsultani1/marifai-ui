// packages/ai-ui/src/hooks/use-typing.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface TypingSignalOptions {
  /** Send the state to other participants, e.g. over a socket. */
  onTypingChange: (typing: boolean) => void;
  /** Quiet time before typing counts as stopped. */
  idleMs?: number;
  /** Re-sends "typing" at this interval during long bursts so receivers don't expire it. */
  refreshMs?: number;
}

export interface TypingSignal {
  /** Call on every keystroke or input event. */
  notifyTyping: () => void;
  /** Call on send or blur to clear the state immediately. */
  stopTyping: () => void;
}

/** Sender side of a typing indicator: reports start, periodic refresh and stop after a quiet period. */
export function useTypingIndicator({ onTypingChange, idleMs = 3000, refreshMs = 5000 }: TypingSignalOptions): TypingSignal {
  const callback = useRef(onTypingChange);
  const typing = useRef(false);
  const lastSent = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    callback.current = onTypingChange;
  }, [onTypingChange]);

  const stopTyping = useCallback(() => {
    clearTimeout(timer.current);
    if (!typing.current) return;
    typing.current = false;
    callback.current(false);
  }, []);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!typing.current || now - lastSent.current >= refreshMs) {
      typing.current = true;
      lastSent.current = now;
      callback.current(true);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(stopTyping, idleMs);
  }, [idleMs, refreshMs, stopTyping]);

  useEffect(() => stopTyping, [stopTyping]);

  return { notifyTyping, stopTyping };
}

export interface TypingUsers {
  /** Names currently typing, in the order they started. */
  names: string[];
  /** Apply a typing event received from another participant. */
  setTyping: (name: string, typing: boolean) => void;
  clear: () => void;
}

/** Receiver side: tracks who is typing and drops anyone whose last signal is older than `ttlMs`. */
export function useTypingUsers(ttlMs = 6000): TypingUsers {
  const [names, setNames] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((name: string) => {
    clearTimeout(timers.current.get(name));
    timers.current.delete(name);
    setNames((current) => (current.includes(name) ? current.filter((item) => item !== name) : current));
  }, []);

  const setTyping = useCallback(
    (name: string, typing: boolean) => {
      if (!typing) {
        remove(name);
        return;
      }
      clearTimeout(timers.current.get(name));
      timers.current.set(
        name,
        setTimeout(() => remove(name), ttlMs),
      );
      setNames((current) => (current.includes(name) ? current : [...current, name]));
    },
    [remove, ttlMs],
  );

  const clear = useCallback(() => {
    for (const handle of timers.current.values()) clearTimeout(handle);
    timers.current.clear();
    setNames([]);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  return { names, setTyping, clear };
}
