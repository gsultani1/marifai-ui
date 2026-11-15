// packages/ai-ui/src/hooks/use-now.ts
import { useEffect, useState } from "react";

/** Current time in ms, refreshed every `intervalMs` while `active`. Clamp derived durations at 0. */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);

  return now;
}
