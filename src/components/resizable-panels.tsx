// packages/ai-ui/src/components/resizable-panels.tsx
"use client";

import { type CSSProperties, Fragment, type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useId, useState, useSyncExternalStore } from "react";

import { cn } from "../lib/cn.js";

export interface ResizablePanel {
  id: string;
  children: ReactNode;
  /** Percent of the group. Panels without one share what is left. */
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  /** Enter on the separator, or double-click, collapses it to `collapsedSize`. */
  collapsible?: boolean;
  collapsedSize?: number;
  /** Names the separator after this panel: "Resize {label}". */
  label?: string;
  className?: string;
}

export interface ResizablePanelsProps {
  panels: ResizablePanel[];
  orientation?: "horizontal" | "vertical";
  sizes?: number[];
  onSizesChange?: (sizes: number[]) => void;
  /** Remembers sizes in localStorage. */
  storageKey?: string;
  className?: string;
  style?: CSSProperties;
}

const noopSubscribe = () => () => undefined;

function readStored(key: string | undefined): string | null {
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Default sizes: given sizes, with the rest shared evenly, scaled to 100. */
export function initialPanelSizes(panels: Pick<ResizablePanel, "defaultSize">[]): number[] {
  const fixed = panels.reduce((sum, panel) => sum + (panel.defaultSize ?? 0), 0);
  const flexible = panels.filter((panel) => panel.defaultSize === undefined).length;
  const share = flexible ? Math.max(0, 100 - fixed) / flexible : 0;
  const sizes = panels.map((panel) => panel.defaultSize ?? share);
  const total = sizes.reduce((sum, size) => sum + size, 0) || 1;
  return sizes.map((size) => (size / total) * 100);
}

/**
 * Moves the boundary after panel `index` by `delta` percent, taking space
 * only from the two neighbors and respecting their min and max sizes.
 */
export function resizePanels(sizes: number[], panels: Pick<ResizablePanel, "minSize" | "maxSize">[], index: number, delta: number): number[] {
  const next = [...sizes];
  const before = next[index]!;
  const after = next[index + 1]!;
  const minBefore = panels[index]?.minSize ?? 0;
  const maxBefore = panels[index]?.maxSize ?? 100;
  const minAfter = panels[index + 1]?.minSize ?? 0;
  const maxAfter = panels[index + 1]?.maxSize ?? 100;
  const lower = Math.max(minBefore - before, after - maxAfter);
  const upper = Math.min(maxBefore - before, after - minAfter);
  const applied = Math.min(upper, Math.max(lower, delta));
  next[index] = before + applied;
  next[index + 1] = after - applied;
  return next;
}

interface Drag {
  index: number;
  start: number;
  sizes: number[];
  extent: number;
}

/**
 * Split panes with draggable, keyboard-operable separators: arrows resize by
 * 1% (Shift for 10%), Home and End go to the limits, Enter collapses a
 * collapsible panel, Escape cancels a drag, and a double-click restores the
 * defaults. Sizes can persist in localStorage.
 */
export function ResizablePanels({ panels, orientation = "horizontal", sizes, onSizesChange, storageKey, className, style }: ResizablePanelsProps) {
  const [local, setLocal] = useState<number[] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [restore, setRestore] = useState<Record<number, number>>({});
  const stored = useSyncExternalStore(noopSubscribe, () => readStored(storageKey), () => null);
  const id = useId();
  const horizontal = orientation === "horizontal";
  const defaults = initialPanelSizes(panels);
  const parsedStored = (() => {
    if (!stored) return null;
    try {
      const value: unknown = JSON.parse(stored);
      return Array.isArray(value) && value.length === panels.length && value.every((item) => typeof item === "number") ? (value as number[]) : null;
    } catch {
      return null;
    }
  })();
  const current = sizes ?? local ?? parsedStored ?? defaults;
  const effectiveMin = (index: number) => (panels[index]?.collapsible ? Math.min(panels[index]?.minSize ?? 0, panels[index]?.collapsedSize ?? 0) : panels[index]?.minSize);
  const limits = panels.map((panel, index) => ({ minSize: effectiveMin(index) ?? 0, maxSize: panel.maxSize ?? 100 }));

  const commit = (next: number[]) => {
    setLocal(next);
    onSizesChange?.(next);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next.map((size) => Math.round(size * 100) / 100)));
      } catch {
        // Sizes just won't persist when storage is unavailable.
      }
    }
  };

  const toggleCollapse = (index: number) => {
    const panel = panels[index];
    if (!panel?.collapsible) return;
    const collapsed = panel.collapsedSize ?? 0;
    if (current[index]! > collapsed + 0.5) {
      setRestore({ ...restore, [index]: current[index]! });
      commit(resizePanels(current, limits, index, collapsed - current[index]!));
    } else {
      const target = restore[index] ?? defaults[index]!;
      commit(resizePanels(current, limits, index, target - current[index]!));
    }
  };

  const endDrag = (cancel: boolean) => {
    if (!drag) return;
    if (cancel) commit(drag.sizes);
    setDrag(null);
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const { body } = document;
    const previous = { cursor: body.style.cursor, userSelect: body.style.userSelect };
    body.style.cursor = horizontal ? "col-resize" : "row-resize";
    body.style.userSelect = "none";
    const stop = () => setDrag(null);
    const onVisibility = () => document.visibilityState === "hidden" && stop();
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      body.style.cursor = previous.cursor;
      body.style.userSelect = previous.userSelect;
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dragging, horizontal]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) return;
    const group = event.currentTarget.parentElement?.getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ index, start: horizontal ? event.clientX : event.clientY, sizes: current, extent: (horizontal ? group?.width : group?.height) || 1 });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (event.buttons === 0) return endDrag(false);
    const delta = (((horizontal ? event.clientX : event.clientY) - drag.start) / drag.extent) * 100;
    commit(resizePanels(drag.sizes, limits, drag.index, delta));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === "Escape") return endDrag(true);
    const step = event.shiftKey ? 10 : 1;
    const back = horizontal ? "ArrowLeft" : "ArrowUp";
    const forward = horizontal ? "ArrowRight" : "ArrowDown";
    let delta: number | null = null;
    if (event.key === back) delta = -step;
    else if (event.key === forward) delta = step;
    else if (event.key === "Home") delta = -100;
    else if (event.key === "End") delta = 100;
    else if (event.key === "Enter") {
      event.preventDefault();
      toggleCollapse(index);
      return;
    }
    if (delta === null) return;
    event.preventDefault();
    commit(resizePanels(current, limits, index, delta));
  };

  return (
    <div data-slot="resizable-panels" className={cn("flex min-h-0 min-w-0", horizontal ? "flex-row" : "flex-col", className)} style={style}>
      {panels.map((panel, index) => (
        <Fragment key={panel.id}>
          <div id={`${id}-${panel.id}`} data-panel={panel.id} className={cn("min-h-0 min-w-0 overflow-auto", panel.className)} style={{ flexGrow: current[index], flexShrink: 1, flexBasis: 0 }}>
            {panel.children}
          </div>
          {index < panels.length - 1 && (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation={horizontal ? "vertical" : "horizontal"}
              aria-label={`Resize ${panel.label ?? `panel ${index + 1}`}`}
              aria-controls={`${id}-${panel.id}`}
              aria-valuenow={Math.round(current[index]!)}
              aria-valuemin={Math.round(limits[index]!.minSize)}
              aria-valuemax={Math.round(limits[index]!.maxSize)}
              onPointerDown={(event) => onPointerDown(event, index)}
              onPointerMove={onPointerMove}
              onPointerUp={() => endDrag(false)}
              onLostPointerCapture={() => endDrag(false)}
              onBlur={() => endDrag(false)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onDoubleClick={() => (panel.collapsible ? toggleCollapse(index) : commit(defaults))}
              className={cn(
                "group relative flex shrink-0 touch-none items-center justify-center bg-border outline-none focus-visible:bg-ring data-[dragging]:bg-ring",
                horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
              )}
              data-dragging={drag?.index === index ? "" : undefined}
            >
              <span aria-hidden="true" className={cn("absolute", horizontal ? "inset-y-0 -inset-x-1.5" : "inset-x-0 -inset-y-1.5")} />
              <span aria-hidden="true" className={cn("z-10 rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:bg-ring group-focus-visible:opacity-100", horizontal ? "h-6 w-1" : "h-1 w-6")} />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
