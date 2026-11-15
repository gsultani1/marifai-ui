// packages/ai-ui/src/components/virtual-list.tsx
"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type UIEvent,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useElementSize } from "../hooks/use-element-size.js";
import { useMeasuredHeights } from "../hooks/use-measured-heights.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface VirtualRangeOptions {
  count: number;
  scrollTop: number;
  viewportHeight: number;
  /** Fixed row height in pixels. */
  itemHeight?: number;
  /** Row tops for variable heights: `offsets[i]` is the top of row i and `offsets[count]` the total height. */
  offsets?: ArrayLike<number>;
  /** Extra rows rendered above and below the viewport. */
  overscan?: number;
}

export interface VirtualRange {
  /** First rendered row, inclusive. */
  start: number;
  /** Last rendered row, exclusive. */
  end: number;
  /** First row that intersects the viewport. */
  visibleStart: number;
  /** Row after the last one that intersects the viewport. */
  visibleEnd: number;
  totalHeight: number;
}

/** Index of the last row whose top is at or above `offset` (offsets must be ascending). */
function rowAt(offsets: ArrayLike<number>, count: number, offset: number): number {
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle]! <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}

/**
 * Rows to render for a scroll position, from a fixed row height or prefix
 * offsets. The scroll position is clamped to the content, and overscan
 * rows are added on both sides without leaving the list.
 */
export function computeVirtualRange({ count, scrollTop, viewportHeight, itemHeight, offsets, overscan = 0 }: VirtualRangeOptions): VirtualRange {
  const rows = Math.max(0, Math.floor(count));
  const extra = Math.max(0, Math.floor(overscan));
  const height = Math.max(0, viewportHeight);
  const fixed = itemHeight !== undefined && itemHeight > 0 ? itemHeight : undefined;
  const totalHeight = rows === 0 ? 0 : fixed !== undefined ? rows * fixed : (offsets?.[rows] ?? 0);
  if (rows === 0 || (fixed === undefined && !offsets)) return { start: 0, end: 0, visibleStart: 0, visibleEnd: 0, totalHeight };
  const top = Math.min(Math.max(0, scrollTop), Math.max(0, totalHeight - height));
  const bottom = top + height;
  let visibleStart: number;
  let visibleEnd: number;
  if (fixed !== undefined) {
    visibleStart = Math.min(rows - 1, Math.floor(top / fixed));
    visibleEnd = Math.min(rows, Math.max(visibleStart + 1, Math.ceil(bottom / fixed)));
  } else {
    visibleStart = rowAt(offsets!, rows, top);
    visibleEnd = visibleStart + 1;
    while (visibleEnd < rows && offsets![visibleEnd]! < bottom) visibleEnd++;
  }
  return { start: Math.max(0, visibleStart - extra), end: Math.min(rows, visibleEnd + extra), visibleStart, visibleEnd, totalHeight };
}

export interface VirtualListHandle {
  /** Scrolls a row into view: "auto" scrolls only as far as needed. */
  scrollToIndex: (index: number, align?: "auto" | "start" | "center" | "end") => void;
}

export interface VirtualListItemState {
  index: number;
  /** Active descendant in listbox mode. */
  active: boolean;
  selected: boolean;
}

export interface VirtualListProps<T> extends Omit<ComponentProps<"div">, "children" | "ref" | "onSelect"> {
  items: readonly T[];
  renderItem: (item: T, state: VirtualListItemState) => ReactNode;
  /** Accessible name of the list. */
  label: string;
  /** Viewport height: pixels or any CSS length. Pixels also size the first render before layout is measured. */
  height: number | string;
  /** Fixed row height in pixels; the fastest mode. */
  itemHeight?: number;
  /** Estimated row height when rows have different heights; rendered rows are measured. */
  estimateHeight?: number;
  getKey?: (item: T, index: number) => string | number;
  /** Rows rendered beyond each edge of the viewport. */
  overscan?: number;
  /** "listbox" makes the list a keyboard-navigable single-select listbox using aria-activedescendant. */
  mode?: "list" | "listbox";
  activeIndex?: number;
  defaultActiveIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  /** Enter, Space or click on an option in listbox mode. */
  onSelect?: (item: T, index: number) => void;
  isSelected?: (item: T, index: number) => boolean;
  emptyLabel?: ReactNode;
  ref?: Ref<VirtualListHandle>;
}

/**
 * Windowed list that renders only the rows in view (plus overscan), for
 * thousands of items. Rows have a fixed `itemHeight`, or an
 * `estimateHeight` refined by measuring each rendered row. Every row
 * carries aria-setsize and aria-posinset so screen readers report the full
 * length. In listbox mode the list is one tab stop using
 * aria-activedescendant: Up, Down, Page Up, Page Down, Home and End move,
 * and Enter or Space selects. `ref.scrollToIndex` scrolls to any row.
 */
export function VirtualList<T>({
  items,
  renderItem,
  label,
  height,
  itemHeight,
  estimateHeight = 40,
  getKey,
  overscan = 6,
  mode = "list",
  activeIndex,
  defaultActiveIndex = -1,
  onActiveIndexChange,
  onSelect,
  isSelected,
  emptyLabel = "No items",
  ref,
  className,
  style,
  onScroll,
  onKeyDown,
  onFocus,
  ...props
}: VirtualListProps<T>) {
  const id = useId();
  const count = items.length;
  const scroller = useRef<HTMLDivElement | null>(null);
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useControllableState({ value: activeIndex, defaultValue: defaultActiveIndex, onChange: onActiveIndexChange });
  const viewportHeight = size.height > 0 ? size.height : typeof height === "number" ? height : 0;
  const keyOf = useCallback((index: number) => String(getKey && index < count ? getKey(items[index]!, index) : index), [getKey, items, count]);
  const anchor = useRef({ visibleStart: 0 });
  const setScroller = useCallback(
    (element: HTMLDivElement | null) => {
      scroller.current = element;
      sizeRef(element);
    },
    [sizeRef],
  );

  const [heights, measure] = useMeasuredHeights((changes) => {
    const element = scroller.current;
    if (!element || itemHeight !== undefined) return;
    let delta = 0;
    for (const change of changes) {
      const index = Number(change.element instanceof HTMLElement ? change.element.dataset.index : NaN);
      if (Number.isInteger(index) && index < anchor.current.visibleStart) delta += change.height - (change.previous ?? estimateHeight);
    }
    if (delta !== 0) element.scrollTop += delta;
  });

  const offsets = useMemo(() => {
    if (itemHeight !== undefined) return undefined;
    const result = new Float64Array(count + 1);
    for (let index = 0; index < count; index++) result[index + 1] = result[index]! + (heights.get(keyOf(index)) ?? estimateHeight);
    return result;
  }, [itemHeight, count, heights, keyOf, estimateHeight]);

  const range = computeVirtualRange({ count, scrollTop, viewportHeight, overscan, ...(itemHeight !== undefined ? { itemHeight } : { offsets: offsets! }) });

  useEffect(() => {
    anchor.current.visibleStart = range.visibleStart;
  }, [range.visibleStart]);

  const topOf = (index: number) => (itemHeight !== undefined ? index * itemHeight : (offsets?.[index] ?? 0));

  const scrollToIndex = (index: number, align: "auto" | "start" | "center" | "end" = "auto") => {
    const element = scroller.current;
    if (count === 0) return;
    const target = Math.min(count - 1, Math.max(0, Math.floor(index)));
    const top = topOf(target);
    const bottom = topOf(target + 1);
    const current = element?.scrollTop ?? scrollTop;
    let next = current;
    if (align === "start") next = top;
    else if (align === "end") next = bottom - viewportHeight;
    else if (align === "center") next = top - (viewportHeight - (bottom - top)) / 2;
    else if (top < current) next = top;
    else if (bottom > current + viewportHeight) next = bottom - viewportHeight;
    next = Math.max(0, Math.min(next, range.totalHeight - viewportHeight));
    if (element) element.scrollTop = next;
    setScrollTop(next);
  };

  useImperativeHandle(ref, () => ({ scrollToIndex }));

  const listbox = mode === "listbox";
  const current = active >= 0 && active < count ? active : -1;
  const optionId = (index: number) => `${id}-option-${index}`;

  const moveActive = (index: number) => {
    if (count === 0) return;
    const next = Math.min(count - 1, Math.max(0, index));
    setActive(next);
    scrollToIndex(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!listbox || event.defaultPrevented || count === 0) return;
    const page = Math.max(1, range.visibleEnd - range.visibleStart - 1);
    const from = current < 0 ? -1 : current;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = from + 1;
    else if (event.key === "ArrowUp") next = from < 0 ? 0 : from - 1;
    else if (event.key === "PageDown") next = from + page;
    else if (event.key === "PageUp") next = from - page;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if ((event.key === "Enter" || event.key === " ") && current >= 0) {
      event.preventDefault();
      onSelect?.(items[current]!, current);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    moveActive(next);
  };

  const rows: ReactNode[] = [];
  for (let index = range.start; index < range.end; index++) {
    const item = items[index]!;
    const key = keyOf(index);
    const selected = isSelected?.(item, index) ?? false;
    const isActive = listbox && index === current;
    rows.push(
      <div
        key={key}
        ref={itemHeight === undefined ? measure : undefined}
        id={listbox ? optionId(index) : undefined}
        role={listbox ? "option" : "listitem"}
        aria-setsize={count}
        aria-posinset={index + 1}
        aria-selected={listbox ? selected : undefined}
        data-index={index}
        data-measure-key={key}
        data-active={isActive ? "" : undefined}
        data-selected={selected ? "" : undefined}
        onClick={
          listbox
            ? () => {
                setActive(index);
                onSelect?.(item, index);
              }
            : undefined
        }
        className={cn("absolute inset-x-0 top-0", listbox && "cursor-default data-[active]:bg-accent data-[active]:text-accent-foreground")}
        style={{ transform: `translateY(${topOf(index)}px)`, ...(itemHeight !== undefined ? { height: itemHeight } : {}) }}
      >
        {renderItem(item, { index, active: isActive, selected })}
      </div>,
    );
  }

  return (
    <div
      ref={setScroller}
      role={listbox && count > 0 ? "listbox" : "list"}
      aria-label={label}
      aria-activedescendant={listbox && current >= 0 && current >= range.start && current < range.end ? optionId(current) : undefined}
      tabIndex={0}
      data-slot="virtual-list"
      onScroll={(event: UIEvent<HTMLDivElement>) => {
        onScroll?.(event);
        setScrollTop(event.currentTarget.scrollTop);
      }}
      onKeyDown={handleKeyDown}
      onFocus={(event) => {
        onFocus?.(event);
        if (listbox && event.target === event.currentTarget && current < 0 && count > 0) setActive(0);
      }}
      className={cn("relative overflow-y-auto overscroll-contain rounded-md", focusRing, className)}
      style={{ height, ...style }}
      {...props}
    >
      {count === 0 ? (
        <div role="listitem" className="p-4 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div style={{ height: range.totalHeight, position: "relative" }}>{rows}</div>
      )}
    </div>
  );
}
