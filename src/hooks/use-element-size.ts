// packages/ai-ui/src/hooks/use-element-size.ts
import { useEffect, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/** Tracks an element's content box size. Attach the returned callback as a ref. */
export function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, ElementSize] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, size];
}
