// packages/ai-ui/src/components/sortable-list.tsx
"use client";

import { GripVerticalIcon } from "lucide-react";
import { type ComponentProps, type FocusEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

/**
 * Returns a copy of `items` with the item at `from` moved to `to` (clamped
 * to the list). An out-of-range `from` returns an unchanged copy.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = items.slice();
  if (!Number.isInteger(from) || from < 0 || from >= result.length) return result;
  const target = Math.min(result.length - 1, Math.max(0, Math.trunc(to)));
  const [item] = result.splice(from, 1);
  result.splice(target, 0, item as T);
  return result;
}

export interface SortableItemState {
  index: number;
  count: number;
  /** The item is picked up by keyboard or being dragged. */
  dragging: boolean;
}

export interface SortableListProps<T> extends Omit<ComponentProps<"div">, "children"> {
  items?: readonly T[];
  defaultItems?: readonly T[];
  /** Called with the new order after a drop. */
  onReorder?: (items: T[]) => void;
  getKey: (item: T) => string;
  /** Plain-text name used in handle labels and announcements. */
  getLabel: (item: T) => string;
  renderItem: (item: T, state: SortableItemState) => ReactNode;
  /** Accessible name of the list. */
  label: string;
  disabled?: boolean;
}

interface Drag<T> {
  key: string;
  from: number;
  preview: T[];
  source: "keyboard" | "pointer";
  pointerId?: number;
}

/**
 * Vertical list reordered by drag handles. Drag with mouse, pen or touch,
 * or use the keyboard on a handle: Space or Enter picks the item up, Up and
 * Down (or Home and End) move it, Space or Enter drops it and Escape
 * cancels and restores the original order. Every step is announced in an
 * assertive live region, such as "Moved Claw hammer to position 3 of 6".
 */
export function SortableList<T>({ items, defaultItems = [], onReorder, getKey, getLabel, renderItem, label, disabled = false, className, ...props }: SortableListProps<T>) {
  const id = useId();
  const [order, setOrder] = useControllableState<readonly T[]>({ value: items, defaultValue: defaultItems, onChange: onReorder ? (next) => onReorder([...next]) : undefined });
  const [drag, setDrag] = useState<Drag<T> | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const shown = drag ? drag.preview : order;
  const count = shown.length;

  const announce = (message: string) => setAnnouncement((previous) => (previous === message ? `${message}\u00a0` : message));
  const nameOf = (key: string) => {
    const item = order.find((candidate) => getKey(candidate) === key);
    return item === undefined ? key : getLabel(item);
  };

  useEffect(() => {
    if (drag?.source !== "keyboard") return;
    const handle = handles.current.get(drag.key);
    if (handle && document.activeElement !== handle) handle.focus();
  }, [drag]);

  const cancel = (current: Drag<T>) => {
    setDrag(null);
    announce(`Reorder cancelled. ${nameOf(current.key)} returned to position ${current.from + 1} of ${order.length}.`);
  };

  useEffect(() => {
    if (drag?.source !== "pointer") return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrag(null);
      setAnnouncement(`Reorder cancelled.`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag?.source]);

  const drop = (current: Drag<T>) => {
    const index = current.preview.findIndex((item) => getKey(item) === current.key);
    setDrag(null);
    if (index !== current.from) {
      setOrder(current.preview);
      announce(`Moved ${nameOf(current.key)} to position ${index + 1} of ${current.preview.length}.`);
    } else {
      announce(`${nameOf(current.key)} dropped in its original position, ${index + 1} of ${current.preview.length}.`);
    }
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string, index: number) => {
    if (disabled) return;
    const active = drag?.key === key && drag.source === "keyboard" ? drag : null;
    if (!active) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setDrag({ key, from: index, preview: [...order], source: "keyboard" });
        announce(`Picked up ${nameOf(key)}, position ${index + 1} of ${order.length}. Use the up and down arrow keys to move it, Space or Enter to drop it, Escape to cancel.`);
      }
      return;
    }
    const position = active.preview.findIndex((item) => getKey(item) === key);
    let target: number | null = null;
    if (event.key === "ArrowUp") target = position - 1;
    else if (event.key === "ArrowDown") target = position + 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = active.preview.length - 1;
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      drop(active);
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel(active);
      return;
    } else if (event.key === "Tab") {
      cancel(active);
      return;
    }
    if (target === null) return;
    event.preventDefault();
    const clamped = Math.min(active.preview.length - 1, Math.max(0, target));
    if (clamped === position) return;
    setDrag({ ...active, preview: moveItem(active.preview, position, clamped) });
    announce(`${nameOf(key)} is now at position ${clamped + 1} of ${active.preview.length}.`);
  };

  const onHandleBlur = (event: FocusEvent<HTMLButtonElement>, key: string) => {
    if (drag?.key !== key || drag.source !== "keyboard") return;
    const next = event.relatedTarget;
    if (next instanceof Node && !list.current?.contains(next)) cancel(drag);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, key: string, index: number) => {
    if (disabled || event.button !== 0 || drag) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus();
    setDrag({ key, from: index, preview: [...order], source: "pointer", pointerId: event.pointerId });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.source !== "pointer" || drag.pointerId !== event.pointerId || !list.current) return;
    const rows = [...list.current.querySelectorAll<HTMLElement>("[data-sortable-key]")].filter((row) => row.dataset.sortableKey !== drag.key);
    let target = rows.length;
    for (let index = 0; index < rows.length; index++) {
      const rect = rows[index]!.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        target = index;
        break;
      }
    }
    const position = drag.preview.findIndex((item) => getKey(item) === drag.key);
    if (position === target) return;
    setDrag({ ...drag, preview: moveItem(drag.preview, position, target) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.source !== "pointer" || drag.pointerId !== event.pointerId) return;
    if (event.type === "pointercancel") {
      setDrag(null);
      return;
    }
    drop(drag);
  };

  const instructions = `${id}-instructions`;
  return (
    <div data-slot="sortable-list" className={cn("flex flex-col", className)} {...props}>
      <p id={instructions} className="sr-only">
        Press Space or Enter to pick up an item, use the up and down arrow keys to move it, then press Space or Enter to drop it or Escape to cancel.
      </p>
      <ul ref={list} aria-label={label} className="flex flex-col gap-1.5">
        {shown.map((item, index) => {
          const key = getKey(item);
          const dragging = drag?.key === key;
          return (
            <li
              key={key}
              data-sortable-key={key}
              data-dragging={dragging ? "" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-card-foreground transition-shadow motion-reduce:transition-none",
                dragging && "z-10 border-ring shadow-lg ring-1 ring-ring",
              )}
            >
              <button
                ref={(element) => {
                  if (element) handles.current.set(key, element);
                  else handles.current.delete(key);
                }}
                type="button"
                aria-label={`Reorder ${getLabel(item)}`}
                aria-describedby={instructions}
                aria-pressed={dragging && drag?.source === "keyboard" ? true : undefined}
                disabled={disabled}
                onKeyDown={(event) => onHandleKeyDown(event, key, index)}
                onBlur={(event) => onHandleBlur(event, key)}
                onPointerDown={(event) => onPointerDown(event, key, index)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={cn(
                  "inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 data-[dragging]:cursor-grabbing [&_svg]:size-4",
                  focusRing,
                )}
                data-dragging={dragging ? "" : undefined}
              >
                <GripVerticalIcon aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">{renderItem(item, { index, count, dragging })}</div>
            </li>
          );
        })}
      </ul>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
