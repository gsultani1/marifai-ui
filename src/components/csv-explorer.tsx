// packages/ai-ui/src/components/csv-explorer.tsx
"use client";

import { type ComponentProps, useMemo, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { topValues } from "../lib/column-profile.js";
import { parseDelimited } from "../lib/csv.js";
import { formatCompactNumber } from "../lib/format.js";
import { detectDelimiter } from "../lib/sheet-ops.js";
import { DataTable, type DataTableColumn } from "./data-table.js";

export interface ColumnProfile {
  name: string;
  filled: number;
  unique: number;
  numeric: boolean;
  min?: number;
  max?: number;
  mean?: number;
  top: Array<{ value: string; count: number }>;
}

const NUMERIC = /^[-+]?\$?\(?\d[\d,]*(\.\d+)?\)?%?$/;

/** Number from a cell such as "$1,200.50", "(15)" or "12%", or null. */
export function parseNumericCell(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !NUMERIC.test(trimmed)) return null;
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith("-");
  const number = Number(trimmed.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(number)) return null;
  return (negative ? -number : number) / (trimmed.endsWith("%") ? 100 : 1);
}

/** Summary statistics per column; a column is numeric when over 90% of filled cells parse as numbers. */
export function profileColumns(header: string[], rows: string[][]): ColumnProfile[] {
  return header.map((name, column) => {
    const values = rows.map((row) => row[column] ?? "").filter((value) => value.trim() !== "");
    const numbers = values.map(parseNumericCell).filter((value): value is number => value !== null);
    const numeric = values.length > 0 && numbers.length / values.length > 0.9;
    const profile: ColumnProfile = { name, filled: values.length, unique: new Set(values).size, numeric, top: topValues(values) };
    if (numeric && numbers.length) {
      profile.min = numbers.reduce((low, value) => Math.min(low, value), Infinity);
      profile.max = numbers.reduce((high, value) => Math.max(high, value), -Infinity);
      profile.mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }
    return profile;
  });
}

export interface CsvExplorerProps extends Omit<ComponentProps<"div">, "children"> {
  /** CSV, TSV, semicolon or pipe separated text; the delimiter is detected. */
  text: string;
  delimiter?: string;
  /** Treat the first row as headers. */
  header?: boolean;
  pageSize?: number;
  /** Rows parsed at most, to keep huge files responsive. */
  maxRows?: number;
  label?: string;
}

/**
 * Explores delimited text: a searchable, sortable, paged table with numeric
 * columns detected and right-aligned, and a Columns view with fill rate,
 * distinct values, range, mean and the most common values.
 */
export function CsvExplorer({ text, delimiter, header = true, pageSize = 100, maxRows = 50_000, label = "Data", className, ...props }: CsvExplorerProps) {
  const [view, setView] = useState<"rows" | "columns">("rows");
  const parsed = useMemo(() => {
    const separator = delimiter ?? detectDelimiter(text);
    const all = parseDelimited(text, separator, maxRows + 1).filter((row) => row.some((cell) => cell.trim() !== ""));
    const width = Math.max(0, ...all.map((row) => row.length));
    const headerRow = header && all.length ? all[0]! : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
    const names = Array.from({ length: width }, (_, index) => headerRow[index]?.trim() || `Column ${index + 1}`);
    const body = (header ? all.slice(1) : all).slice(0, maxRows);
    return { separator, names, body, truncated: (header ? all.length - 1 : all.length) > maxRows };
  }, [text, delimiter, header, maxRows]);
  const profiles = useMemo(() => profileColumns(parsed.names, parsed.body), [parsed]);

  type Row = Record<string, string | number | null> & { __index: number };
  const keys = parsed.names.map((_, index) => `c${index}`);
  const rows = useMemo<Row[]>(
    () =>
      parsed.body.map((cells, index) => {
        const row: Row = { __index: index };
        parsed.names.forEach((_, column) => {
          const raw = cells[column] ?? "";
          row[`c${column}`] = profiles[column]?.numeric ? parseNumericCell(raw) : raw;
        });
        return row;
      }),
    [parsed, profiles],
  );
  const columns: DataTableColumn<Row>[] = keys.map((key, column) => ({
    key: key as keyof Row & string,
    header: parsed.names[column],
    type: profiles[column]?.numeric ? "number" : "text",
    sortable: true,
  }));

  const tab = (value: "rows" | "columns", text: string) => (
    <button type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn("h-7 rounded-md px-2.5 text-xs hover:bg-accent aria-pressed:bg-accent aria-pressed:font-medium", focusRing)}>
      {text}
    </button>
  );

  return (
    <div data-slot="csv-explorer" className={cn("flex min-h-0 flex-col gap-2 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {tab("rows", "Rows")}
          {tab("columns", "Columns")}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {parsed.body.length.toLocaleString()} rows · {parsed.names.length} columns
          {parsed.truncated && ` · first ${maxRows.toLocaleString()} shown`}
        </span>
      </div>
      {view === "rows" ? (
        <DataTable columns={columns} rows={rows} getRowKey={(row) => row.__index} searchable pageSize={pageSize} label={label} emptyMessage="No rows" />
      ) : (
        <ul aria-label="Column profiles" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <li key={profile.name} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{profile.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{profile.numeric ? "Number" : "Text"}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-2 text-xs tabular-nums">
                <dt className="text-muted-foreground">Filled</dt>
                <dd>
                  {profile.filled.toLocaleString()} of {parsed.body.length.toLocaleString()}
                </dd>
                <dt className="text-muted-foreground">Distinct</dt>
                <dd>{profile.unique.toLocaleString()}</dd>
                {profile.numeric && profile.min !== undefined && (
                  <>
                    <dt className="text-muted-foreground">Range</dt>
                    <dd>
                      {formatCompactNumber(profile.min)} to {formatCompactNumber(profile.max!)}
                    </dd>
                    <dt className="text-muted-foreground">Mean</dt>
                    <dd>{formatCompactNumber(Math.round(profile.mean! * 100) / 100)}</dd>
                  </>
                )}
              </dl>
              {!profile.numeric && profile.top.length > 0 && (
                <ul aria-label={`Most common in ${profile.name}`} className="flex flex-col gap-1">
                  {profile.top.map((item) => (
                    <li key={item.value} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 truncate">{item.value}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full bg-primary" style={{ width: `${(item.count / profile.filled) * 100}%` }} />
                      </span>
                      <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">{item.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
