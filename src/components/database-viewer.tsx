// packages/ai-ui/src/components/database-viewer.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { ArrowDownIcon, ArrowUpIcon, BarChart3Icon, CheckIcon, CopyIcon, KeyRoundIcon, TableIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { cellText, type ColumnProfileData, profileColumn } from "../lib/column-profile.js";
import { formatCompactNumber } from "../lib/format.js";
import { usePortalContainer } from "../lib/portal.js";
import { JsonViewer } from "./json-viewer.js";
import { Pagination } from "./pagination.js";
import { SearchInput } from "./search-input.js";
import { SegmentedControl } from "./segmented-control.js";
import { SurfaceState } from "./surface-state.js";

export interface DatabaseColumn {
  name: string;
  /** Declared type, e.g. "INTEGER" or "TEXT". */
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
}

export interface DatabaseTable {
  name: string;
  rowCount?: number;
  columns: DatabaseColumn[];
}

export type DatabaseRow = Record<string, unknown>;

export interface DatabaseRowsRequest {
  offset: number;
  limit: number;
  sort?: { column: string; direction: "ascending" | "descending" };
}

export interface DatabaseViewerProps {
  tables: DatabaseTable[];
  /** Loads one page of rows; the signal aborts when the user moves on. Keep the function stable. */
  loadRows: (table: string, request: DatabaseRowsRequest, signal: AbortSignal) => Promise<{ rows: DatabaseRow[]; total: number }>;
  pageSize?: number;
  defaultTable?: string;
  label?: string;
  className?: string;
}

export interface ColumnProfileCardProps {
  name: string;
  declaredType?: string;
  profile: ColumnProfileData;
  /** Where the numbers come from, e.g. "From the 50 rows on this page". */
  note?: string;
  className?: string;
}

function formatStat(value: number | string | undefined): string {
  if (value === undefined) return "–";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}

/** Column summary: type, empty values, distinct count, range, mean and the most common values. */
export function ColumnProfileCard({ name, declaredType, profile, note, className }: ColumnProfileCardProps) {
  const max = profile.top[0]?.count ?? 1;
  const stats: Array<[string, string]> = [
    ["Type", declaredType ? `${declaredType} (${profile.type})` : profile.type],
    ["Empty", `${profile.nulls.toLocaleString()} of ${profile.count.toLocaleString()}`],
    ["Distinct", profile.distinct.toLocaleString()],
    ...(profile.min !== undefined ? ([["Min", formatStat(profile.min)], ["Max", formatStat(profile.max)]] as Array<[string, string]>) : []),
    ...(profile.mean !== undefined ? ([["Mean", formatStat(profile.mean)]] as Array<[string, string]>) : []),
  ];
  return (
    <div data-slot="column-profile" className={cn("flex flex-col gap-3 text-sm", className)}>
      <p className="font-semibold">{name}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {stats.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="truncate text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {profile.top.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Most common</p>
          <ul className="flex flex-col gap-1">
            {profile.top.map((item) => (
              <li key={item.value} className="relative flex items-center justify-between gap-2 overflow-hidden rounded px-1.5 py-0.5 text-xs">
                <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${(item.count / max) * 100}%` }} />
                <span className="relative truncate">{item.value || "(empty)"}</span>
                <span className="relative tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function looksLikeJson(value: unknown): unknown {
  if (value !== null && typeof value === "object") return value;
  if (typeof value === "string" && /^\s*[[{]/.test(value)) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

type Result = { key: string; rows: DatabaseRow[]; total: number } | { key: string; error: string };

/**
 * Database browser for generated apps: tables with row counts, paged and
 * sortable rows in a keyboard grid (arrows move, Enter opens a cell), cell
 * detail with JSON formatting, column profiles and the schema.
 */
export function DatabaseViewer({ tables, loadRows, pageSize = 50, defaultTable, label = "Database", className }: DatabaseViewerProps) {
  const [tableName, setTableName] = useState(defaultTable ?? tables[0]?.name ?? "");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DatabaseRowsRequest["sort"]>(undefined);
  const [view, setView] = useState<"data" | "schema">("data");
  const [filter, setFilter] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cell, setCell] = useState<{ row: number; column: number }>({ row: 0, column: 0 });
  const [detail, setDetail] = useState<{ row: number; column: number } | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const container = usePortalContainer();
  const id = useId();
  const table = tables.find((item) => item.name === tableName) ?? tables[0];
  const key = JSON.stringify([table?.name, page, pageSize, sort, attempt]);
  const loading = result?.key !== key;
  const rows = result && !loading && "rows" in result ? result.rows : [];
  const total = result && !loading && "rows" in result ? result.total : (table?.rowCount ?? 0);
  const error = result && !loading && "error" in result ? result.error : null;
  const columns = table?.columns ?? [];
  const activeCell = { row: Math.min(cell.row, Math.max(0, rows.length - 1)), column: Math.min(cell.column, Math.max(0, columns.length - 1)) };

  useEffect(() => {
    const [name, pageNumber, size, order] = JSON.parse(key) as [string | null, number, number, DatabaseRowsRequest["sort"]];
    if (!name) return;
    const controller = new AbortController();
    loadRows(name, { offset: (pageNumber - 1) * size, limit: size, ...(order ? { sort: order } : {}) }, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key, rows: data.rows, total: data.total });
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error: reason instanceof Error ? reason.message : "Couldn't load rows." });
      },
    );
    return () => controller.abort();
  }, [key, loadRows]);

  const selectTable = (name: string) => {
    setTableName(name);
    setPage(1);
    setSort(undefined);
    setDetail(null);
    setCell({ row: 0, column: 0 });
  };

  const toggleSort = (column: string) => {
    setSort(sort?.column !== column ? { column, direction: "ascending" } : sort.direction === "ascending" ? { column, direction: "descending" } : undefined);
    setPage(1);
  };

  const focusCell = (row: number, column: number) => {
    setCell({ row, column });
    requestAnimationFrame(() => document.getElementById(`${id}-cell-${row}-${column}`)?.focus());
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const { row, column } = activeCell;
    const last = { row: rows.length - 1, column: columns.length - 1 };
    const moves: Record<string, [number, number]> = {
      ArrowDown: [Math.min(last.row, row + 1), column],
      ArrowUp: [Math.max(0, row - 1), column],
      ArrowRight: [row, Math.min(last.column, column + 1)],
      ArrowLeft: [row, Math.max(0, column - 1)],
      Home: event.ctrlKey ? [0, 0] : [row, 0],
      End: event.ctrlKey ? [last.row, last.column] : [row, last.column],
    };
    const next = moves[event.key];
    if (next && rows.length) {
      event.preventDefault();
      focusCell(next[0], next[1]);
    } else if (event.key === "Enter" && rows.length) {
      event.preventDefault();
      setDetail({ row, column });
    }
  };

  const needle = filter.trim().toLowerCase();
  const listed = tables.filter((item) => !needle || item.name.toLowerCase().includes(needle));
  const detailRow = detail ? rows[detail.row] : undefined;
  const detailColumn = detail ? columns[detail.column] : undefined;
  const detailValue = detailRow && detailColumn ? detailRow[detailColumn.name] : undefined;
  const detailJson = looksLikeJson(detailValue);

  return (
    <div data-slot="database-viewer" className={cn("@container flex min-h-0 overflow-hidden rounded-lg border border-border bg-background text-sm", className)}>
      <nav aria-label={`${label} tables`} className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @2xl:w-56">
        <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tables</p>
        {tables.length > 8 && <SearchInput label="Filter tables" placeholder="Filter" value={filter} onValueChange={setFilter} resultCount={listed.length} />}
        {listed.map((item) => (
          <button
            key={item.name}
            type="button"
            aria-current={item.name === table?.name ? "true" : undefined}
            onClick={() => selectTable(item.name)}
            className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent aria-[current=true]:bg-accent aria-[current=true]:font-medium [&_svg]:size-4 [&_svg]:shrink-0", focusRing)}
          >
            <TableIcon aria-hidden="true" className="text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.name}</span>
            {item.rowCount !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCompactNumber(item.rowCount)}
                <span className="sr-only"> rows</span>
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        {table ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <h3 className="font-mono text-sm font-semibold">{table.name}</h3>
              <span className="text-xs text-muted-foreground">{total.toLocaleString()} rows</span>
              <SegmentedControl
                label="View"
                size="sm"
                value={view}
                onValueChange={setView}
                className="ml-auto"
                options={[
                  { value: "data", label: "Data" },
                  { value: "schema", label: "Schema" },
                ]}
              />
            </div>
            {view === "schema" ? (
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Columns of {table.name}</caption>
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-1 pr-4 font-medium">Column</th>
                      <th scope="col" className="py-1 pr-4 font-medium">Type</th>
                      <th scope="col" className="py-1 pr-4 font-medium">Nullable</th>
                      <th scope="col" className="py-1 font-medium">Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns.map((column) => (
                      <tr key={column.name} className="border-t border-border">
                        <td className="py-1.5 pr-4 font-mono text-xs">{column.name}</td>
                        <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground">{column.type}</td>
                        <td className="py-1.5 pr-4">{column.nullable === false ? "No" : "Yes"}</td>
                        <td className="py-1.5">{column.primaryKey ? "Primary" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1">
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="relative min-h-0 flex-1 overflow-auto" aria-busy={loading || undefined}>
                    {error ? (
                      <SurfaceState kind="error" title="Couldn't load rows" description={error} onRetry={() => setAttempt(attempt + 1)} className="h-full" />
                    ) : (
                      <table role="grid" aria-label={`Rows of ${table.name}`} aria-rowcount={total + 1} aria-colcount={columns.length} onKeyDown={onGridKeyDown} className="w-full border-separate border-spacing-0 text-left font-mono text-xs">
                        <thead className="sticky top-0 z-10 bg-background">
                          <tr aria-rowindex={1}>
                            {columns.map((column) => {
                              const sorted = sort?.column === column.name ? sort.direction : undefined;
                              return (
                                <th key={column.name} scope="col" aria-sort={sorted ?? "none"} className="border-b border-border bg-muted/60 p-0 font-medium whitespace-nowrap">
                                  <div className="flex items-center">
                                    <button type="button" onClick={() => toggleSort(column.name)} className={cn("flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5 text-left hover:bg-accent [&_svg]:size-3", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                                      {column.primaryKey && <KeyRoundIcon aria-label="Primary key" className="text-muted-foreground" />}
                                      <span className="truncate">{column.name}</span>
                                      {sorted === "ascending" && <ArrowUpIcon aria-hidden="true" />}
                                      {sorted === "descending" && <ArrowDownIcon aria-hidden="true" />}
                                    </button>
                                    <Popover.Root>
                                      <Popover.Trigger aria-label={`Profile ${column.name}`} title="Column profile" disabled={!rows.length} className={cn(iconButton, "size-6 rounded-sm [&_svg]:size-3.5", focusRing)}>
                                        <BarChart3Icon aria-hidden="true" />
                                      </Popover.Trigger>
                                      <Popover.Portal container={container}>
                                        <Popover.Positioner sideOffset={4} align="start" collisionPadding={8} className="z-50">
                                          <Popover.Popup aria-label={`Profile of ${column.name}`} className={cn(popupSurface, "w-64 p-3 font-sans outline-none")}>
                                            <ColumnProfileCard name={column.name} declaredType={column.type} profile={profileColumn(rows.map((row) => row[column.name]))} note={`From the ${rows.length} rows on this page.`} />
                                          </Popover.Popup>
                                        </Popover.Positioner>
                                      </Popover.Portal>
                                    </Popover.Root>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rowIndex) => (
                            <tr key={rowIndex} aria-rowindex={(page - 1) * pageSize + rowIndex + 2} className="hover:bg-accent/40">
                              {columns.map((column, columnIndex) => {
                                const value = row[column.name];
                                const active = activeCell.row === rowIndex && activeCell.column === columnIndex;
                                return (
                                  <td
                                    key={column.name}
                                    role="gridcell"
                                    id={`${id}-cell-${rowIndex}-${columnIndex}`}
                                    tabIndex={active ? 0 : -1}
                                    aria-selected={detail?.row === rowIndex && detail.column === columnIndex}
                                    onFocus={() => setCell({ row: rowIndex, column: columnIndex })}
                                    onClick={() => {
                                      setCell({ row: rowIndex, column: columnIndex });
                                      setDetail({ row: rowIndex, column: columnIndex });
                                    }}
                                    className={cn("max-w-64 cursor-default truncate border-b border-border px-2 py-1.5 outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-selected:bg-accent", typeof value === "number" && "text-right tabular-nums")}
                                  >
                                    {value === null || value === undefined ? <span className="text-muted-foreground italic">NULL</span> : cellText(value)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {!error && !loading && rows.length === 0 && <p className="p-6 text-center text-muted-foreground">This table is empty.</p>}
                    {loading && <p role="status" className="sr-only">Loading rows</p>}
                  </div>
                  {total > pageSize && <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} onPageChange={(next) => { setPage(next); setDetail(null); }} totalItems={total} pageSize={pageSize} variant="compact" label={`Pages of ${table.name}`} className="border-t border-border px-3 py-1.5" />}
                </div>
                {detail && detailColumn && detailRow && (
                  <aside aria-labelledby={`${id}-detail-title`} className="flex w-72 shrink-0 flex-col border-l border-border font-sans">
                    <div className="flex items-center gap-1 border-b border-border px-3 py-2">
                      <h4 id={`${id}-detail-title`} className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">
                        {detailColumn.name} · row {(page - 1) * pageSize + detail.row + 1}
                      </h4>
                      <button type="button" aria-label="Copy value" title="Copy value" onClick={() => void copy(detailJson !== undefined ? JSON.stringify(detailJson, null, 2) : cellText(detailValue))} className={cn(iconButton, "size-7", focusRing)}>
                        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                      </button>
                      <button type="button" aria-label="Close cell detail" onClick={() => { setDetail(null); focusCell(detail.row, detail.column); }} className={cn(iconButton, "size-7", focusRing)}>
                        <XIcon aria-hidden="true" />
                      </button>
                    </div>
                    <div tabIndex={0} role="region" aria-label="Cell value" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                      {detailJson !== undefined ? <JsonViewer value={detailJson} defaultExpandDepth={2} label={`${detailColumn.name} value`} /> : detailValue === null || detailValue === undefined ? <p className="text-muted-foreground italic">NULL</p> : <pre className="font-mono text-xs break-words whitespace-pre-wrap">{cellText(detailValue)}</pre>}
                      <dl className="flex flex-col gap-1 border-t border-border pt-3 text-xs">
                        {columns.filter((column) => column.name !== detailColumn.name).map((column) => (
                          <div key={column.name} className="flex gap-2">
                            <dt className="w-24 shrink-0 truncate font-mono text-muted-foreground">{column.name}</dt>
                            <dd className="min-w-0 flex-1 truncate font-mono">{detailRow[column.name] === null || detailRow[column.name] === undefined ? "NULL" : cellText(detailRow[column.name])}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </>
        ) : (
          <SurfaceState kind="empty" title="No tables" description="This app hasn't created any tables yet." className="h-full" />
        )}
      </div>
    </div>
  );
}
