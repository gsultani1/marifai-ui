// packages/ai-ui/src/hooks/use-measured-heights.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface HeightChange {
  key: string;
  previous: number | undefined;
  height: number;
  element: Element;
}

/**
 * Border-box heights of elements, keyed by their `data-measure-key`, from a
 * single ResizeObserver. Attach the returned callback as each element's
 * ref; it stays stable. `onChange` runs before the state update, for
 * adjustments such as scroll anchoring.
 */
export function useMeasuredHeights(onChange?: (changes: HeightChange[]) => void): [ReadonlyMap<string, number>, (element: HTMLElement | null) => (() => void) | undefined] {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());
  const observer = useRef<ResizeObserver | null>(null);
  const known = useRef(new Map<string, number>());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
    },
    [],
  );

  const measure = useCallback((element: HTMLElement | null) => {
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    observer.current ??= new ResizeObserver((entries) => {
      const changes: HeightChange[] = [];
      for (const entry of entries) {
        const key = entry.target instanceof HTMLElement ? entry.target.dataset.measureKey : undefined;
        if (key === undefined) continue;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        const previous = known.current.get(key);
        if (previous === height) continue;
        known.current.set(key, height);
        changes.push({ key, previous, height, element: entry.target });
      }
      if (changes.length === 0) return;
      onChangeRef.current?.(changes);
      setHeights(new Map(known.current));
    });
    const current = observer.current;
    current.observe(element);
    return () => current.unobserve(element);
  }, []);

  return [heights, measure];
}
