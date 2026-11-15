// packages/ai-ui/src/components/data-table.tsx
"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { Pagination } from "./pagination.js";

export interface DataTableColumn<Row> {
  key: keyof Row & string;
  header: ReactNode;
  /** "number" right-aligns, sorts numerically and edits with a numeric input. */
  type?: "text" | "number";
  /** Editable when the table also receives `onRowsChange`. */
  editable?: boolean;
  sortable?: boolean;
  render?: (row: Row) => ReactNode;
  className?: string;
}

export type DataTableSort = { key: string; direction: "ascending" | "descending" } | null;

export interface DataTableProps<Row extends object> extends Omit<ComponentProps<"div">, "children"> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /**
   * Turns the table into an editable grid. Receives every row, in the
   * original order. While a returned promise is pending no new edit starts,
   * and a rejection shows `saveErrorMessage`.
   */
  onRowsChange?: (rows: Row[]) => void | Promise<void>;
  onSaveError?: (error: unknown) => void;
  saveErrorMessage?: ReactNode;
  getRowKey?: (row: Row, index: number) => string | number;
  caption?: ReactNode;
  /** Accessible name of the table when `caption` is not plain text. */
  label?: string;
  emptyMessage?: ReactNode;
  defaultSort?: DataTableSort;
  /** Adds a filter field that matches any cell's text. */
  searchable?: boolean;
  /** Splits rows into pages of this size. */
  pageSize?: number;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function compareCells(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  return formatCell(left).localeCompare(formatCell(right), undefined, { numeric: true, sensitivity: "base" });
}

const SORT_CYCLE: Array<"ascending" | "descending" | null> = ["ascending", "descending", null];

export function DataTable<Row extends object>({
  columns,
  rows,
  onRowsChange,
  onSaveError,
  saveErrorMessage = "Changes could not be saved.",
  getRowKey = (_row, index) => index,
  caption,
  label,
  emptyMessage = "No rows",
  defaultSort = null,
  searchable = false,
  pageSize,
  className,
  ...props
}: DataTableProps<Row>) {
  const interactive = Boolean(onRowsChange);
  const [sort, setSort] = useState<DataTableSort>(defaultSort);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [active, setActive] = useState({ row: 0, col: 0 });
  const [editing, setEditing] = useState<{ original: number; col: number; draft: string; invalid: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const savingRef = useRef(false);
  const editFinished = useRef(true);
  const tableRef = useRef<HTMLTableElement>(null);
  const id = useId();
  const name = label ?? (typeof caption === "string" ? caption : "Data table");

  const order = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const indices = rows
      .map((_, index) => index)
      .filter(
        (index) =>
          !needle ||
          columns.some((column) => formatCell(rows[index]![column.key]).toLocaleLowerCase().includes(needle)),
      );
    if (!sort) return indices;
    const direction = sort.direction === "ascending" ? 1 : -1;
    const key = sort.key as keyof Row;
    return indices.sort((a, b) => compareCells(rows[a]![key], rows[b]![key]) * direction || a - b);
  }, [rows, columns, query, sort]);

  const size = pageSize && Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : order.length || 1;
  const pageCount = Math.max(1, Math.ceil(order.length / size));
  const currentPage = Math.min(page, pageCount - 1);
  const offset = currentPage * size;
  const visible = order.slice(offset, offset + size);

  const focusCell = (row: number, col: number) => {
    const next = {
      row: Math.max(0, Math.min(visible.length - 1, row)),
      col: Math.max(0, Math.min(columns.length - 1, col)),
    };
    setActive(next);
    tableRef.current?.querySelector<HTMLElement>(`[data-cell="${next.row}:${next.col}"]`)?.focus();
  };

  const activeRow = Math.min(active.row, Math.max(visible.length - 1, 0));
  const activeCol = Math.min(active.col, Math.max(columns.length - 1, 0));
  const isEditable = (col: number) => interactive && Boolean(columns[col]?.editable);

  const startEditing = (row: number, col: number) => {
    const column = columns[col];
    const original = visible[row];
    const source = original === undefined ? undefined : rows[original];
    if (!column || !source || original === undefined || !isEditable(col) || savingRef.current) return;
    const raw = source[column.key];
    editFinished.current = false;
    setSaveFailed(false);
    setEditing({ original, col, draft: typeof raw === "number" ? String(raw) : formatCell(raw), invalid: false });
  };

  const save = (next: Row[]) => {
    if (!onRowsChange) return;
    const fail = (error: unknown) => {
      setSaveFailed(true);
      onSaveError?.(error);
    };
    let result: void | Promise<void>;
    try {
      result = onRowsChange(next);
    } catch (error) {
      fail(error);
      return;
    }
    if (!(result instanceof Promise)) return;
    savingRef.current = true;
    setSaving(true);
    result.catch(fail).finally(() => {
      savingRef.current = false;
      setSaving(false);
    });
  };

  /**
   * Ends the edit once: saves unless cancelled, and refocuses only for
   * keyboard exits. An invalid number keeps the editor open with a message.
   */
  const finishEditing = (commit: boolean, focusTarget: { row: number; col: number } | null) => {
    if (!editing || editFinished.current) return;
    const column = columns[editing.col]!;
    const parsed = column.type === "number" ? Number(editing.draft) : editing.draft;
    const valid = typeof parsed !== "number" || (editing.draft.trim() !== "" && Number.isFinite(parsed));
    if (commit && !valid) {
      setEditing({ ...editing, invalid: true });
      return;
    }
    editFinished.current = true;
    setEditing(null);
    if (commit) save(rows.map((row, index) => (index === editing.original ? { ...row, [column.key]: parsed } : row)));
    if (focusTarget) focusCell(focusTarget.row, focusTarget.col);
  };

  const onCellKeyDown = (event: KeyboardEvent<HTMLTableCellElement>, row: number, col: number) => {
    if (editing) return;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col],
      ArrowLeft: [row, col - 1],
      ArrowRight: [row, col + 1],
      Home: event.ctrlKey ? [0, 0] : [row, 0],
      End: event.ctrlKey ? [order.length - 1, columns.length - 1] : [row, columns.length - 1],
      PageUp: [row - 10, col],
      PageDown: [row + 10, col],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      focusCell(move[0], move[1]);
    } else if ((event.key === "Enter" || event.key === "F2") && isEditable(col)) {
      event.preventDefault();
      startEditing(row, col);
    }
  };

  return (
    <div
      data-slot="data-table"
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
      {...props}
    >
      {searchable && (
        <div className="relative shrink-0 border-b border-border p-2">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label={`Search ${name}`}
            placeholder="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            className={cn(
              "h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-sm placeholder:text-muted-foreground",
              focusRing,
            )}
          />
        </div>
      )}
      <div
        role={interactive ? undefined : "region"}
        aria-label={interactive ? undefined : name}
        tabIndex={interactive ? undefined : 0}
        className={cn(
          "relative min-h-0 flex-1 overflow-auto",
          !interactive && "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
        )}
      >
        <table
          ref={tableRef}
          role={interactive ? "grid" : undefined}
          aria-label={caption ? undefined : name}
          aria-rowcount={interactive ? order.length + 1 : undefined}
          aria-busy={saving || undefined}
          className="w-full border-collapse text-sm"
        >
          {caption && <caption className="px-3 py-2 text-left text-sm font-medium">{caption}</caption>}
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <tr>
              {columns.map((column) => {
                const sorted = sort?.key === column.key ? sort.direction : null;
                const sortable = column.sortable ?? true;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={sortable ? (sorted ?? "none") : undefined}
                    className={cn(
                      "border-b border-border px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground",
                      column.type === "number" && "text-right",
                      column.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = SORT_CYCLE[(SORT_CYCLE.indexOf(sorted) + 1) % SORT_CYCLE.length] ?? null;
                          setSort(next ? { key: column.key, direction: next } : null);
                          setPage(0);
                        }}
                        className={cn(
                          "-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground [&_svg]:size-3.5",
                          column.type === "number" && "flex-row-reverse",
                          focusRing,
                        )}
                      >
                        {column.header}
                        {sorted === "ascending" ? (
                          <ArrowUpIcon aria-hidden="true" />
                        ) : sorted === "descending" ? (
                          <ArrowDownIcon aria-hidden="true" />
                        ) : (
                          <ArrowUpDownIcon aria-hidden="true" className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  {query.trim() && rows.length > 0 ? "No matching rows" : emptyMessage}
                </td>
              </tr>
            )}
            {visible.map((original, rowIndex) => {
              const row = rows[original]!;
              return (
                <tr
                  key={getRowKey(row, original)}
                  aria-rowindex={interactive ? offset + rowIndex + 2 : undefined}
                  className="border-b border-border last:border-b-0 hover:bg-muted/40"
                >
                  {columns.map((column, colIndex) => {
                    const isActive = activeRow === rowIndex && activeCol === colIndex;
                    const isEditing = editing?.original === original && editing.col === colIndex;
                    return (
                      <td
                        key={column.key}
                        role={interactive ? "gridcell" : undefined}
                        aria-readonly={interactive && !isEditable(colIndex) ? true : undefined}
                        data-cell={interactive ? `${rowIndex}:${colIndex}` : undefined}
                        tabIndex={interactive ? (isActive ? 0 : -1) : undefined}
                        onFocus={interactive ? () => setActive({ row: rowIndex, col: colIndex }) : undefined}
                        onKeyDown={interactive ? (event) => onCellKeyDown(event, rowIndex, colIndex) : undefined}
                        onDoubleClick={interactive ? () => startEditing(rowIndex, colIndex) : undefined}
                        className={cn(
                          "px-3 py-2 align-top",
                          column.type === "number" && "text-right tabular-nums",
                          interactive && "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                          isEditing && "p-0",
                          column.className,
                        )}
                      >
                        {isEditing ? (
                          <>
                            <input
                              autoFocus
                              aria-label={`Edit ${typeof column.header === "string" ? column.header : column.key}`}
                              aria-invalid={editing.invalid || undefined}
                              aria-describedby={editing.invalid ? `${id}-invalid` : undefined}
                              type={column.type === "number" ? "number" : "text"}
                              value={editing.draft}
                              onChange={(event) => setEditing({ ...editing, draft: event.target.value, invalid: false })}
                              onBlur={() => finishEditing(true, null)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  finishEditing(true, { row: rowIndex, col: colIndex });
                                } else if (event.key === "Tab") {
                                  event.preventDefault();
                                  finishEditing(true, { row: rowIndex, col: colIndex + (event.shiftKey ? -1 : 1) });
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  finishEditing(false, { row: rowIndex, col: colIndex });
                                }
                              }}
                              className={cn(
                                "h-full w-full min-w-24 bg-background px-3 py-2 outline-none ring-2 ring-ring ring-inset aria-invalid:ring-destructive",
                                column.type === "number" && "text-right",
                              )}
                            />
                            {editing.invalid && (
                              <p id={`${id}-invalid`} role="alert" className="px-3 py-1 text-left text-xs text-destructive">
                                Enter a number.
                              </p>
                            )}
                          </>
                        ) : (
                          (column.render?.(row) ?? formatCell(row[column.key]))
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {saveFailed && (
        <p role="alert" className="shrink-0 border-t border-border px-3 py-2 text-sm text-destructive">
          {saveErrorMessage}
        </p>
      )}
      {interactive && (
        <span role="status" className="sr-only">
          {saving ? "Saving changes" : ""}
        </span>
      )}
      {pageCount > 1 && <Pagination variant="compact" label="Table pagination" page={currentPage + 1} pageCount={pageCount} onPageChange={(next) => setPage(next - 1)} className="shrink-0 border-t border-border px-2 py-1" />}
    </div>
  );
}
