// packages/ai-ui/src/components/table.tsx
"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

/** Sort state of a column, as `aria-sort` names it. */
export type TableSortDirection = "ascending" | "descending" | "none";

/** Next state when a sortable header is pressed: none, then ascending, then descending, then none. */
export function cycleSortDirection(current: TableSortDirection): TableSortDirection {
  return current === "none" ? "ascending" : current === "ascending" ? "descending" : "none";
}

export interface TableProps extends ComponentProps<"table"> {
  /** Names the table and its scroll region; the region becomes keyboard-scrollable when set. */
  label?: string;
  /** Class for the scroll wrapper around the table. */
  containerClassName?: string;
}

/**
 * Semantic table in a horizontally scrollable wrapper. With `label`, the
 * wrapper is a named, focusable region so keyboard users can scroll wide
 * tables, and the table carries the same name.
 */
export function Table({ label, containerClassName, className, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={cn("relative w-full overflow-x-auto rounded-md", label && "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", containerClassName)}
    >
      <table data-slot="table" aria-label={label} className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export interface TableHeaderProps extends ComponentProps<"thead"> {
  /** Keeps the header row visible while the container scrolls vertically. */
  sticky?: boolean;
}

export function TableHeader({ sticky = false, className, ...props }: TableHeaderProps) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b [&_tr]:border-border", sticky && "sticky top-0 z-10 bg-background", className)} {...props} />;
}

export type TableBodyProps = ComponentProps<"tbody">;

export function TableBody({ className, ...props }: TableBodyProps) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export type TableFooterProps = ComponentProps<"tfoot">;

export function TableFooter({ className, ...props }: TableFooterProps) {
  return <tfoot data-slot="table-footer" className={cn("border-t border-border bg-muted/50 font-medium [&>tr:last-child]:border-b-0", className)} {...props} />;
}

export interface TableRowProps extends ComponentProps<"tr"> {
  /** Highlights the row, for example when its checkbox is ticked. */
  selected?: boolean;
}

export function TableRow({ selected = false, className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      className={cn("border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}

const alignments = { start: "text-left", center: "text-center", end: "text-right" } as const;

export interface TableHeadProps extends Omit<ComponentProps<"th">, "align"> {
  align?: keyof typeof alignments;
  /** Current sort; with `onSort` the header becomes a sort button and the cell gets `aria-sort`. */
  sortDirection?: TableSortDirection;
  /** Called when the sort button is pressed; pair with `cycleSortDirection`. */
  onSort?: () => void;
}

/** Column header cell, optionally a sort toggle that announces its state through `aria-sort`. */
export function TableHead({ align = "start", sortDirection = "none", onSort, scope = "col", className, children, ...props }: TableHeadProps) {
  const SortIcon = sortDirection === "ascending" ? ArrowUpIcon : sortDirection === "descending" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <th
      data-slot="table-head"
      scope={scope}
      aria-sort={onSort ? sortDirection : undefined}
      className={cn("h-10 px-3 align-middle font-medium whitespace-nowrap text-muted-foreground", alignments[align], className)}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn("-mx-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded px-1.5 font-medium hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5", align === "end" && "flex-row-reverse", focusRing)}
        >
          {children}
          <SortIcon aria-hidden="true" className={cn(sortDirection === "none" && "opacity-50")} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableCellProps extends Omit<ComponentProps<"td">, "align"> {
  align?: keyof typeof alignments;
}

export function TableCell({ align = "start", className, ...props }: TableCellProps) {
  return <td data-slot="table-cell" className={cn("px-3 py-2 align-middle text-foreground", align === "end" && "tabular-nums", alignments[align], className)} {...props} />;
}

export type TableCaptionProps = ComponentProps<"caption">;

export function TableCaption({ className, ...props }: TableCaptionProps) {
  return <caption data-slot="table-caption" className={cn("mt-3 text-sm text-muted-foreground", className)} {...props} />;
}
