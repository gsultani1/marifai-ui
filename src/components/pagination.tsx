// packages/ai-ui/src/components/pagination.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useId } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type PaginationEntry = number | "ellipsis-start" | "ellipsis-end";

/**
 * Page numbers to show: the first and last `boundaries` pages, `siblings`
 * around the current one, and an ellipsis for each gap of two or more.
 */
export function paginationRange(page: number, pageCount: number, siblings = 1, boundaries = 1): PaginationEntry[] {
  const count = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), count);
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
  if (count <= boundaries * 2 + siblings * 2 + 3) return range(1, count);
  const start = range(1, boundaries);
  const end = range(count - boundaries + 1, count);
  const middleStart = Math.max(Math.min(current - siblings, count - boundaries - siblings * 2 - 1), boundaries + 2);
  const middleEnd = Math.min(Math.max(current + siblings, boundaries + siblings * 2 + 2), count - boundaries - 1);
  return [
    ...start,
    ...(middleStart > boundaries + 2 ? (["ellipsis-start"] as const) : range(boundaries + 1, middleStart - 1)),
    ...range(middleStart, middleEnd),
    ...(middleEnd < count - boundaries - 1 ? (["ellipsis-end"] as const) : range(middleEnd + 1, count - boundaries)),
    ...end,
  ];
}

export interface PaginationProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  siblings?: number;
  boundaries?: number;
  /** With pageSize, shows "21–40 of 312". */
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizes?: number[];
  /** "compact" shows only "Page x of y" with previous and next. */
  variant?: "full" | "compact";
  label?: string;
  className?: string;
}

/** Page navigation with numbered pages and ellipses, previous and next, an item range and an optional page-size select. */
export function Pagination({ page, pageCount, onPageChange, siblings = 1, boundaries = 1, totalItems, pageSize, onPageSizeChange, pageSizes = [10, 20, 50, 100], variant = "full", label = "Pagination", className }: PaginationProps) {
  const id = useId();
  const count = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), count);
  const format = new Intl.NumberFormat();
  const from = totalItems !== undefined && pageSize ? Math.min(totalItems, (current - 1) * pageSize + 1) : null;
  const to = totalItems !== undefined && pageSize ? Math.min(totalItems, current * pageSize) : null;

  const previous = (
    <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => onPageChange(current - 1)} className={cn(iconButton, focusRing)}>
      <ChevronLeftIcon aria-hidden="true" />
    </button>
  );
  const next = (
    <button type="button" aria-label="Next page" disabled={current >= count} onClick={() => onPageChange(current + 1)} className={cn(iconButton, focusRing)}>
      <ChevronRightIcon aria-hidden="true" />
    </button>
  );

  if (variant === "compact") {
    return (
      <nav aria-label={label} className={cn("flex items-center justify-end gap-1 text-xs text-muted-foreground", className)}>
        <span aria-live="polite" className="mr-1">
          Page {current} of {count}
        </span>
        {previous}
        {next}
      </nav>
    );
  }

  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {from !== null && to !== null && totalItems !== undefined && (
          <span aria-live="polite">
            {totalItems === 0 ? "No results" : `${format.format(from)}–${format.format(to)} of ${format.format(totalItems)}`}
          </span>
        )}
        {onPageSizeChange && pageSize && (
          <label htmlFor={`${id}-size`} className="flex items-center gap-1.5">
            Rows per page
            <select id={`${id}-size`} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className={cn("h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground", focusRing, "focus-visible:ring-offset-0")}>
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <ul className="flex items-center gap-1">
        <li>{previous}</li>
        {paginationRange(current, count, siblings, boundaries).map((entry) =>
          typeof entry === "number" ? (
            <li key={entry}>
              <button
                type="button"
                aria-label={`Page ${entry}`}
                aria-current={entry === current ? "page" : undefined}
                onClick={() => entry !== current && onPageChange(entry)}
                className={cn("inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums hover:bg-accent aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground", focusRing)}
              >
                {entry}
              </button>
            </li>
          ) : (
            <li key={entry} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ),
        )}
        <li>{next}</li>
      </ul>
    </nav>
  );
}
