// packages/ai-ui/src/components/masonry.tsx
"use client";

import { Children, type ComponentProps, isValidElement, type ReactNode } from "react";

import { useElementSize } from "../hooks/use-element-size.js";
import { useMeasuredHeights } from "../hooks/use-measured-heights.js";
import { cn } from "../lib/cn.js";

/** Columns that fit a width when each must be at least `minColumnWidth` wide; at least 1. */
export function masonryColumnCount(width: number, minColumnWidth: number, gap = 0, maxColumns = Number.POSITIVE_INFINITY): number {
  if (!(width > 0) || !(minColumnWidth > 0)) return 1;
  const fit = Math.floor((width + gap) / (minColumnWidth + gap));
  return Math.max(1, Math.min(fit, Math.max(1, Math.floor(maxColumns))));
}

export interface MasonryPlacement {
  column: number;
  top: number;
}

export interface MasonryLayout {
  placements: MasonryPlacement[];
  /** Height of the tallest column. */
  height: number;
}

/** Places each item, in order, at the top of the currently shortest column (the leftmost on ties). */
export function computeMasonryLayout(heights: readonly number[], columns: number, gap = 0): MasonryLayout {
  const count = Math.max(1, Math.floor(columns));
  const columnHeights = new Array<number>(count).fill(0);
  const placements = heights.map((height) => {
    let column = 0;
    for (let index = 1; index < count; index++) if (columnHeights[index]! < columnHeights[column]!) column = index;
    const top = columnHeights[column]!;
    columnHeights[column] = top + Math.max(0, height) + gap;
    return { column, top };
  });
  const tallest = Math.max(...columnHeights);
  return { placements, height: heights.length === 0 ? 0 : Math.max(0, tallest - gap) };
}

export interface MasonryProps<T> extends Omit<ComponentProps<"div">, "children"> {
  /** Items as data, rendered with `renderItem`. */
  items?: readonly T[];
  renderItem?: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
  /** Items as children, when not using `items`. */
  children?: ReactNode;
  /** Narrowest a column may get, in pixels; sets the column count from the container width. */
  minColumnWidth?: number;
  maxColumns?: number;
  /** Space between items in pixels. */
  gap?: number;
}

/**
 * Masonry layout that balances items across columns by their measured
 * heights, with the column count derived from the container width and a
 * minimum column width. Items stay in source order in the DOM, so reading
 * and tab order follow the data. Before layout is measured (on the server,
 * or without ResizeObserver) it renders as a single column.
 */
export function Masonry<T>({ items, renderItem, getKey, children, minColumnWidth = 240, maxColumns, gap = 16, className, style, ...props }: MasonryProps<T>) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [heights, measure] = useMeasuredHeights();
  const entries: Array<{ key: string; node: ReactNode }> =
    items && renderItem
      ? items.map((item, index) => ({ key: String(getKey ? getKey(item, index) : index), node: renderItem(item, index) }))
      : Children.toArray(children).map((child, index) => ({ key: isValidElement(child) && child.key !== null ? String(child.key) : String(index), node: child }));
  const width = size.width;
  const columns = masonryColumnCount(width, minColumnWidth, gap, maxColumns);
  const columnWidth = columns > 0 ? (width - gap * (columns - 1)) / columns : width;
  const laidOut = width > 0;
  const layout = computeMasonryLayout(
    entries.map((entry) => heights.get(entry.key) ?? 0),
    columns,
    gap,
  );
  return (
    <div
      ref={containerRef}
      data-slot="masonry"
      data-columns={laidOut ? columns : 1}
      className={cn(laidOut ? "relative" : "flex flex-col", className)}
      style={{ ...(laidOut ? { height: layout.height } : { gap }), ...style }}
      {...props}
    >
      {entries.map((entry, index) => {
        const placement = layout.placements[index]!;
        const measured = heights.has(entry.key);
        return (
          <div
            key={entry.key}
            ref={measure}
            data-measure-key={entry.key}
            data-slot="masonry-item"
            className={cn(laidOut && "absolute")}
            style={
              laidOut
                ? {
                    width: columnWidth,
                    insetInlineStart: placement.column * (columnWidth + gap),
                    top: placement.top,
                    visibility: measured ? undefined : "hidden",
                  }
                : undefined
            }
          >
            {entry.node}
          </div>
        );
      })}
    </div>
  );
}
