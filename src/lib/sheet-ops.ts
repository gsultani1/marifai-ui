// packages/ai-ui/src/lib/sheet-ops.ts
import { inferFillSeries } from "./fill-series.js";
import {
  cellAddress,
  type CellValue,
  displayCellValue,
  isFormulaError,
  parseCellAddress,
  renameSheetInFormula,
  shiftFormulaReferences,
  transformFormulaReferences,
} from "./formula.js";

export type NumberFormat = "general" | "number" | "currency" | "percent" | "date";

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  numberFormat?: NumberFormat;
}

export interface SpreadsheetSheet {
  id: string;
  name: string;
  /** Raw input by address: { A1: "Item", B2: "=SUM(B3:B9)" }. */
  cells: Record<string, string>;
  formats?: Record<string, CellFormat>;
  /** Column widths in pixels by column index. */
  columnWidths?: Record<number, number>;
  frozenRows?: number;
  frozenColumns?: number;
}

export interface CellRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export function normalizeRange(a: { row: number; column: number }, b: { row: number; column: number }): CellRange {
  return { top: Math.min(a.row, b.row), bottom: Math.max(a.row, b.row), left: Math.min(a.column, b.column), right: Math.max(a.column, b.column) };
}

export function rangeAddress(range: CellRange): string {
  const start = cellAddress(range.top, range.left);
  return range.top === range.bottom && range.left === range.right ? start : `${start}:${cellAddress(range.bottom, range.right)}`;
}

export function inRange(range: CellRange, row: number, column: number): boolean {
  return row >= range.top && row <= range.bottom && column >= range.left && column <= range.right;
}

/** Rows and columns in use: one past the last non-empty cell. */
export function sheetExtent(sheet: Pick<SpreadsheetSheet, "cells">): { rows: number; columns: number } {
  let rows = 0;
  let columns = 0;
  for (const [address, raw] of Object.entries(sheet.cells)) {
    if (raw === "") continue;
    const cell = parseCellAddress(address);
    if (!cell) continue;
    rows = Math.max(rows, cell.row + 1);
    columns = Math.max(columns, cell.column + 1);
  }
  return { rows, columns };
}

function remapCells<T>(record: Record<string, T> | undefined, map: (row: number, column: number) => { row: number; column: number } | null): Record<string, T> | undefined {
  if (!record) return record;
  const next: Record<string, T> = {};
  for (const [address, value] of Object.entries(record)) {
    const cell = parseCellAddress(address);
    if (!cell) continue;
    const target = map(cell.row, cell.column);
    if (target) next[cellAddress(target.row, target.column)] = value;
  }
  return next;
}

/** Sets or clears cells; null or "" removes the entry. */
export function setCells(sheet: SpreadsheetSheet, updates: Record<string, string | null>): SpreadsheetSheet {
  const cells = { ...sheet.cells };
  for (const [address, raw] of Object.entries(updates)) {
    if (raw === null || raw === "") delete cells[address];
    else cells[address] = raw;
  }
  return { ...sheet, cells };
}

export function clearRange(sheet: SpreadsheetSheet, range: CellRange): SpreadsheetSheet {
  const updates: Record<string, null> = {};
  for (const address of Object.keys(sheet.cells)) {
    const cell = parseCellAddress(address);
    if (cell && inRange(range, cell.row, cell.column)) updates[address] = null;
  }
  return setCells(sheet, updates);
}

export function formatRange(sheet: SpreadsheetSheet, range: CellRange, patch: CellFormat): SpreadsheetSheet {
  const formats = { ...sheet.formats };
  for (let row = range.top; row <= range.bottom; row++) {
    for (let column = range.left; column <= range.right; column++) {
      const address = cellAddress(row, column);
      const next = { ...formats[address], ...patch };
      for (const key of Object.keys(next) as Array<keyof CellFormat>) if (next[key] === undefined || next[key] === false) delete next[key];
      if (Object.keys(next).length === 0) delete formats[address];
      else formats[address] = next;
    }
  }
  return { ...sheet, formats };
}

/** Raw contents of a range as rows of strings. */
export function readBlock(sheet: SpreadsheetSheet, range: CellRange): string[][] {
  const block: string[][] = [];
  for (let row = range.top; row <= range.bottom; row++) {
    const line: string[] = [];
    for (let column = range.left; column <= range.right; column++) line.push(sheet.cells[cellAddress(row, column)] ?? "");
    block.push(line);
  }
  return block;
}

/**
 * Writes a block at a cell. With `shiftFrom`, formulas move their relative
 * references by the distance between the source and the target, as a paste
 * of copied cells does.
 */
export function writeBlock(sheet: SpreadsheetSheet, at: { row: number; column: number }, block: string[][], shiftFrom?: { row: number; column: number }): SpreadsheetSheet {
  const updates: Record<string, string | null> = {};
  block.forEach((line, r) =>
    line.forEach((raw, c) => {
      const value = shiftFrom && raw.startsWith("=") ? shiftFormulaReferences(raw, at.row - shiftFrom.row, at.column - shiftFrom.column) : raw;
      updates[cellAddress(at.row + r, at.column + c)] = value;
    }),
  );
  return setCells(sheet, updates);
}

/**
 * Extends `source` to fill `target` (which contains it) downward or to the
 * right: formulas are copied with shifted references, values continue their
 * series with `inferFillSeries`.
 */
export function fillRange(sheet: SpreadsheetSheet, source: CellRange, target: CellRange, direction: "down" | "right"): SpreadsheetSheet {
  const updates: Record<string, string | null> = {};
  const formats = { ...sheet.formats };
  if (direction === "down") {
    const height = source.bottom - source.top + 1;
    const count = target.bottom - source.bottom;
    for (let column = source.left; column <= source.right; column++) {
      const values = Array.from({ length: height }, (_, index) => sheet.cells[cellAddress(source.top + index, column)] ?? "");
      const formula = values.some((value) => value.startsWith("="));
      const series = formula ? [] : inferFillSeries(values, count);
      for (let index = 0; index < count; index++) {
        const row = source.bottom + 1 + index;
        const from = source.top + ((row - source.top) % height);
        const raw = formula ? values[from - source.top]! : series[index]!;
        updates[cellAddress(row, column)] = raw.startsWith("=") ? shiftFormulaReferences(raw, row - from, 0) : raw;
        const format = sheet.formats?.[cellAddress(from, column)];
        if (format) formats[cellAddress(row, column)] = format;
      }
    }
  } else {
    const width = source.right - source.left + 1;
    const count = target.right - source.right;
    for (let row = source.top; row <= source.bottom; row++) {
      const values = Array.from({ length: width }, (_, index) => sheet.cells[cellAddress(row, source.left + index)] ?? "");
      const formula = values.some((value) => value.startsWith("="));
      const series = formula ? [] : inferFillSeries(values, count);
      for (let index = 0; index < count; index++) {
        const column = source.right + 1 + index;
        const from = source.left + ((column - source.left) % width);
        const raw = formula ? values[from - source.left]! : series[index]!;
        updates[cellAddress(row, column)] = raw.startsWith("=") ? shiftFormulaReferences(raw, 0, column - from) : raw;
        const format = sheet.formats?.[cellAddress(row, from)];
        if (format) formats[cellAddress(row, column)] = format;
      }
    }
  }
  return { ...setCells(sheet, updates), formats };
}

type Axis = "rows" | "columns";

function shiftAxis(sheets: SpreadsheetSheet[], index: number, axis: Axis, at: number, count: number): SpreadsheetSheet[] {
  const name = sheets[index]!.name.toLowerCase();
  const moveIndex = (value: number, role: "cell" | "start" | "end" = "cell") => {
    if (count > 0) return value >= at ? value + count : value;
    const removed = -count;
    if (value >= at && value < at + removed) return role === "start" ? at : role === "end" ? at - 1 : null;
    return value >= at + removed ? value - removed : value;
  };
  const transformFor = (own: boolean) =>
    (formula: string) =>
      transformFormulaReferences(formula, (position) => {
        const targetsSheet = position.sheet === undefined ? own : position.sheet.toLowerCase() === name;
        if (!targetsSheet) return { row: position.row, column: position.column };
        if (axis === "rows") {
          const row = moveIndex(position.row, position.role);
          return row === null ? null : { row, column: position.column };
        }
        const column = moveIndex(position.column, position.role);
        return column === null ? null : { row: position.row, column };
      });

  return sheets.map((sheet, sheetIndex) => {
    const own = sheetIndex === index;
    const rewrite = transformFor(own);
    let cells: Record<string, string> = {};
    for (const [address, raw] of Object.entries(sheet.cells)) cells[address] = raw.startsWith("=") ? rewrite(raw) : raw;
    if (!own) return { ...sheet, cells };
    const map = (row: number, column: number) => {
      if (axis === "rows") {
        const next = moveIndex(row);
        return next === null ? null : { row: next, column };
      }
      const next = moveIndex(column);
      return next === null ? null : { row, column: next };
    };
    cells = remapCells(cells, map)!;
    const formats = remapCells(sheet.formats, map);
    let columnWidths = sheet.columnWidths;
    if (axis === "columns" && columnWidths) {
      const widths: Record<number, number> = {};
      for (const [key, width] of Object.entries(columnWidths)) {
        const next = moveIndex(Number(key));
        if (next !== null) widths[next] = width;
      }
      columnWidths = widths;
    }
    return { ...sheet, cells, ...(formats ? { formats } : {}), ...(columnWidths ? { columnWidths } : {}) };
  });
}

/** Inserts rows or columns and rewrites references to them in every sheet. */
export function insertAxis(sheets: SpreadsheetSheet[], sheetIndex: number, axis: Axis, at: number, count = 1): SpreadsheetSheet[] {
  return shiftAxis(sheets, sheetIndex, axis, at, count);
}

/** Deletes rows or columns; references into them become #REF!. */
export function deleteAxis(sheets: SpreadsheetSheet[], sheetIndex: number, axis: Axis, at: number, count = 1): SpreadsheetSheet[] {
  return shiftAxis(sheets, sheetIndex, axis, at, -count);
}

/** Renames a sheet and updates references to it from every sheet. */
export function renameSheet(sheets: SpreadsheetSheet[], sheetIndex: number, name: string): SpreadsheetSheet[] {
  const from = sheets[sheetIndex]!.name;
  return sheets.map((sheet, index) => {
    const cells: Record<string, string> = {};
    for (const [address, raw] of Object.entries(sheet.cells)) cells[address] = raw.startsWith("=") ? renameSheetInFormula(raw, from, name) : raw;
    return index === sheetIndex ? { ...sheet, name, cells } : { ...sheet, cells };
  });
}

function sortKey(value: CellValue): [number, number | string] {
  if (value === null || value === "") return [3, 0];
  if (typeof value === "number") return [0, value];
  if (typeof value === "string") return [1, value.toLowerCase()];
  if (typeof value === "boolean") return [2, value ? 1 : 0];
  return [isFormulaError(value) ? 4 : 3, 0];
}

/**
 * Stable sort of the rows in `range` by one column's computed values. Blank
 * cells go last in both directions; formulas keep pointing at their own row.
 */
export function sortRange(sheet: SpreadsheetSheet, range: CellRange, column: number, direction: "asc" | "desc", valueAt: (row: number, column: number) => CellValue): SpreadsheetSheet {
  const rows = Array.from({ length: range.bottom - range.top + 1 }, (_, index) => range.top + index);
  const keyed = rows.map((row) => ({ row, key: sortKey(valueAt(row, column)) }));
  keyed.sort((a, b) => {
    if (a.key[0] !== b.key[0]) return a.key[0] - b.key[0];
    if (a.key[0] >= 3) return 0;
    const order = typeof a.key[1] === "number" ? (a.key[1] as number) - (b.key[1] as number) : String(a.key[1]).localeCompare(String(b.key[1]), undefined, { numeric: true });
    return direction === "asc" ? order : -order;
  });
  const updates: Record<string, string | null> = {};
  const formats = { ...sheet.formats };
  keyed.forEach(({ row: from }, index) => {
    const to = range.top + index;
    for (let c = range.left; c <= range.right; c++) {
      const raw = sheet.cells[cellAddress(from, c)] ?? "";
      updates[cellAddress(to, c)] = raw.startsWith("=") ? shiftFormulaReferences(raw, to - from, 0) : raw;
      const format = sheet.formats?.[cellAddress(from, c)];
      if (format) formats[cellAddress(to, c)] = format;
      else delete formats[cellAddress(to, c)];
    }
  });
  return { ...setCells(sheet, updates), formats };
}

/** Display values of a range as delimited text, quoting fields that need it. */
export function toDelimited(rows: string[][], delimiter = ","): string {
  const quote = (field: string) => (field.includes(delimiter) || /["\r\n]/.test(field) || /^\s|\s$/.test(field) ? `"${field.replace(/"/g, '""')}"` : field);
  return rows.map((row) => row.map(quote).join(delimiter)).join("\r\n");
}

/** Picks the delimiter that splits the first lines most consistently: comma, tab, semicolon or pipe. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 10);
  let best = ",";
  let bestScore = 0;
  for (const delimiter of [",", "\t", ";", "|"]) {
    const counts = lines.map((line) => {
      let count = 0;
      let quoted = false;
      for (const char of line) {
        if (char === '"') quoted = !quoted;
        else if (char === delimiter && !quoted) count++;
      }
      return count;
    });
    const first = counts[0] ?? 0;
    const consistent = counts.filter((count) => count === first).length;
    const score = first > 0 ? consistent * 1000 + first : 0;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Computed display values of the used area, for CSV export. Text that a
 * spreadsheet app would run as a formula (=, +, -, @) gets a leading
 * apostrophe so opening the file cannot execute it.
 */
export function sheetToRows(sheet: SpreadsheetSheet, valueAt: (row: number, column: number) => CellValue): string[][] {
  const { rows, columns } = sheetExtent(sheet);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const value = valueAt(row, column);
      const text = displayCellValue(value);
      return typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    }),
  );
}

/** Builds cells from parsed rows, capped to keep huge imports responsive. */
export function rowsToCells(rows: string[][], { maxRows = 5000, maxColumns = 200 }: { maxRows?: number; maxColumns?: number } = {}): Record<string, string> {
  const cells: Record<string, string> = {};
  rows.slice(0, maxRows).forEach((row, r) =>
    row.slice(0, maxColumns).forEach((value, c) => {
      if (value !== "") cells[cellAddress(r, c)] = value;
    }),
  );
  return cells;
}
