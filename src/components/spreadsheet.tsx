// packages/ai-ui/src/components/spreadsheet.tsx
"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  BoldIcon,
  DownloadIcon,
  FilterIcon,
  ItalicIcon,
  Redo2Icon,
  SnowflakeIcon,
  TableRowsSplitIcon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react";
import {
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText } from "../lib/download.js";
import { parseDelimited } from "../lib/csv.js";
import {
  cellAddress,
  type CellValue,
  columnName,
  createWorkbookEvaluator,
  displayCellValue,
  FORMULA_FUNCTIONS,
  isFormulaError,
  serialToDate,
} from "../lib/formula.js";
import {
  type CellFormat,
  type CellRange,
  clearRange,
  deleteAxis,
  detectDelimiter,
  fillRange,
  formatRange,
  inRange,
  insertAxis,
  normalizeRange,
  type NumberFormat,
  rangeAddress,
  readBlock,
  renameSheet,
  rowsToCells,
  setCells,
  sheetExtent,
  sheetToRows,
  sortRange,
  type SpreadsheetSheet,
  toDelimited,
  writeBlock,
} from "../lib/sheet-ops.js";
import { ActionContextMenu, ActionMenu, type MenuEntry } from "./action-menu.js";
import { SheetTabs, ValueFilter } from "./spreadsheet-parts.js";

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 28;
const ROW_HEADER_WIDTH = 48;
const DEFAULT_WIDTH = 104;
const MIN_WIDTH = 36;
const OVERSCAN = 6;
const HISTORY_LIMIT = 100;
const AGGREGATE_LIMIT = 100_000;

interface Point {
  row: number;
  column: number;
}

interface Selection {
  anchor: Point;
  focus: Point;
  /** Extra ranges added with Ctrl or Cmd. */
  extra: CellRange[];
}

interface Editing {
  row: number;
  column: number;
  value: string;
  original: string;
  source: "cell" | "bar";
}

const DEFAULT_SHEETS: SpreadsheetSheet[] = [{ id: "sheet-1", name: "Sheet1", cells: {} }];

/** A blank or prefilled sheet with a unique id for a workbook. */
export function createSpreadsheetSheet(name: string, cells: Record<string, string> = {}, existing: SpreadsheetSheet[] = []): SpreadsheetSheet {
  const taken = new Set(existing.map((sheet) => sheet.id));
  let index = existing.length + 1;
  while (taken.has(`sheet-${index}`)) index++;
  return { id: `sheet-${index}`, name, cells };
}

function nextSheetName(sheets: SpreadsheetSheet[], base = "Sheet"): string {
  const names = new Set(sheets.map((sheet) => sheet.name.toLowerCase()));
  let index = sheets.length + 1;
  while (names.has(`${base}${index}`.toLowerCase())) index++;
  return `${base}${index}`;
}

function inferredFormat(raw: string | undefined): NumberFormat | undefined {
  return raw && /^=\s*(TODAY|DATE|NOW)\s*\(/i.test(raw) ? "date" : undefined;
}

/** Display text for a value under a number format. */
export function formatCellValue(value: CellValue, format: NumberFormat = "general", { currency = "USD", locale }: { currency?: string; locale?: string } = {}): string {
  if (typeof value !== "number" || format === "general") return displayCellValue(value);
  if (!Number.isFinite(value)) return "#NUM!";
  switch (format) {
    case "number":
      return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    case "currency":
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
    case "percent":
      return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
    case "date":
      return serialToDate(value).toLocaleDateString(locale);
  }
}

/** Distinct cells of the ranges inside the used area, capped for huge selections. */
function collectCells(ranges: CellRange[], extent: { rows: number; columns: number }): Point[] {
  const seen = new Set<string>();
  const cells: Point[] = [];
  for (const range of ranges) {
    const bottom = Math.min(range.bottom, extent.rows - 1);
    const right = Math.min(range.right, extent.columns - 1);
    for (let row = range.top; row <= bottom; row++) {
      for (let column = range.left; column <= right; column++) {
        const key = `${row}:${column}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({ row, column });
        if (cells.length >= AGGREGATE_LIMIT) return cells;
      }
    }
  }
  return cells;
}

function textWidth(text: string): number {
  if (typeof document === "undefined") return text.length * 7.5;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit;font-size:14px";
  probe.textContent = text;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width || text.length * 7.5;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

const NUMBER_FORMATS: Array<{ value: NumberFormat; label: string }> = [
  { value: "general", label: "General" },
  { value: "number", label: "Number (1,000.00)" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "date", label: "Date" },
];

export interface SpreadsheetProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
  /** Controlled workbook. */
  sheets?: SpreadsheetSheet[];
  defaultSheets?: SpreadsheetSheet[];
  onSheetsChange?: (sheets: SpreadsheetSheet[]) => void;
  readOnly?: boolean;
  /** Minimum grid size; it grows to fit data and the active cell. */
  rowCount?: number;
  columnCount?: number;
  /** Height of the grid area. */
  height?: number | string;
  label?: string;
  currency?: string;
  locale?: string;
  /** Hides the formatting toolbar. */
  hideToolbar?: boolean;
}

/**
 * Spreadsheet with a formula engine, multiple sheets, virtualized rows and
 * columns, multi-range selection, fill handle, clipboard with reference
 * shifting, freeze panes, sort, value filters, number formats, undo, CSV
 * import and export, and a selection summary. The grid is an ARIA grid
 * driven from the keyboard like a desktop spreadsheet.
 */
export function Spreadsheet({
  sheets: sheetsProp,
  defaultSheets = DEFAULT_SHEETS,
  onSheetsChange,
  readOnly = false,
  rowCount: minRows = 100,
  columnCount: minColumns = 26,
  height = "28rem",
  label = "Spreadsheet",
  currency = "USD",
  locale,
  hideToolbar = false,
  className,
  ...props
}: SpreadsheetProps) {
  const [sheets, setSheets] = useControllableState({ value: sheetsProp, defaultValue: defaultSheets, onChange: onSheetsChange });
  const [activeId, setActiveId] = useState(() => sheets[0]?.id ?? "sheet-1");
  const foundIndex = sheets.findIndex((sheet) => sheet.id === activeId);
  const sheetIndex = foundIndex === -1 ? 0 : foundIndex;
  const sheet = sheets[sheetIndex] ?? DEFAULT_SHEETS[0]!;
  const [history, setHistory] = useState<{ past: SpreadsheetSheet[][]; future: SpreadsheetSheet[][] }>({ past: [], future: [] });
  const [selection, setSelection] = useState<Selection>({ anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 }, extra: [] });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [filters, setFilters] = useState<Record<string, Record<number, string[]>>>({});
  const [view, setView] = useState({ top: 0, left: 0, width: 960, height: 448 });
  const [resizing, setResizing] = useState<{ column: number; width: number } | null>(null);
  const [fillTarget, setFillTarget] = useState<CellRange | null>(null);
  const [suggestion, setSuggestion] = useState(0);
  const [notice, setNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollTarget = useRef<Point | null>(null);
  const clipboard = useRef<{ text: string; block: string[][]; origin: Point; cut: boolean } | null>(null);
  const editingRef = useRef<Editing | null>(null);
  const id = useId();
  const updateEditing = (next: Editing | null) => {
    editingRef.current = next;
    setEditing(next);
  };

  const evaluator = useMemo(() => createWorkbookEvaluator(sheets), [sheets]);
  const valueAt = useCallback((row: number, column: number) => evaluator.value(sheetIndex, row, column), [evaluator, sheetIndex]);
  const extent = useMemo(() => sheetExtent(sheet), [sheet]);
  const frozenRows = Math.max(0, sheet.frozenRows ?? 0);
  const frozenColumns = Math.max(0, sheet.frozenColumns ?? 0);
  const headerRows = Math.max(1, frozenRows);
  const active = selection.anchor;
  const rowCount = Math.max(minRows, extent.rows + 20, active.row + 20, selection.focus.row + 1);
  const columnCount = Math.max(minColumns, extent.columns + 2, active.column + 3, selection.focus.column + 1);
  const sheetFilters = useMemo(() => filters[sheet.id] ?? {}, [filters, sheet.id]);
  const filterEntries = Object.entries(sheetFilters);

  const rows = useMemo(() => {
    const entries = Object.entries(sheetFilters);
    if (entries.length === 0) return Array.from({ length: rowCount }, (_, index) => index);
    const allowed = entries.map(([column, values]) => [Number(column), new Set(values)] as const);
    const result: number[] = [];
    for (let row = 0; row < rowCount; row++) {
      if (row < headerRows || row >= extent.rows || allowed.every(([column, set]) => set.has(displayCellValue(valueAt(row, column))))) result.push(row);
    }
    return result;
  }, [rowCount, sheetFilters, headerRows, extent.rows, valueAt]);
  const positionOf = useMemo(() => {
    const map = new Map<number, number>();
    rows.forEach((row, position) => map.set(row, position));
    return map;
  }, [rows]);

  const widths = useMemo(
    () => Array.from({ length: columnCount }, (_, column) => (resizing?.column === column ? resizing.width : (sheet.columnWidths?.[column] ?? DEFAULT_WIDTH))),
    [columnCount, sheet.columnWidths, resizing],
  );
  const offsets = useMemo(() => {
    const result = [ROW_HEADER_WIDTH];
    for (const width of widths) result.push(result.at(-1)! + width);
    return result;
  }, [widths]);
  const totalWidth = offsets.at(-1)!;
  const totalHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT;
  const frozenWidth = offsets[Math.min(frozenColumns, columnCount)]!;
  const frozenHeight = HEADER_HEIGHT + frozenRows * ROW_HEIGHT;

  const primary = normalizeRange(selection.anchor, selection.focus);
  const ranges = [...selection.extra, primary];
  const isSelected = (row: number, column: number) => ranges.some((range) => inRange(range, row, column));
  const formatAt = (row: number, column: number): CellFormat | undefined => sheet.formats?.[cellAddress(row, column)];
  const rawAt = (row: number, column: number) => sheet.cells[cellAddress(row, column)] ?? "";
  const display = (row: number, column: number) => {
    const raw = rawAt(row, column);
    return formatCellValue(valueAt(row, column), formatAt(row, column)?.numberFormat ?? inferredFormat(raw), { currency, ...(locale ? { locale } : {}) });
  };

  /* ---------------- history ---------------- */

  const commit = (next: SpreadsheetSheet[]) => {
    setHistory((current) => ({ past: [...current.past.slice(-(HISTORY_LIMIT - 1)), sheets], future: [] }));
    setSheets(next);
  };
  const updateSheet = (update: (sheet: SpreadsheetSheet) => SpreadsheetSheet) => commit(sheets.map((item, index) => (index === sheetIndex ? update(item) : item)));
  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [sheets, ...history.future] });
    setSheets(previous);
  };
  const redo = () => {
    const next = history.future[0];
    if (!next) return;
    setHistory({ past: [...history.past, sheets], future: history.future.slice(1) });
    setSheets(next);
  };

  /* ---------------- viewport ---------------- */

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setView((current) => ({ ...current, width: element.clientWidth || current.width, height: element.clientHeight || current.height })));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = scrollTarget.current;
    const element = scrollRef.current;
    if (!target || !element) return;
    scrollTarget.current = null;
    const position = positionOf.get(target.row);
    if (position !== undefined && position >= frozenRows) {
      const y = HEADER_HEIGHT + position * ROW_HEIGHT;
      if (y - element.scrollTop < frozenHeight) element.scrollTop = y - frozenHeight;
      else if (y + ROW_HEIGHT > element.scrollTop + element.clientHeight) element.scrollTop = y + ROW_HEIGHT - element.clientHeight;
    }
    if (target.column >= frozenColumns) {
      const x = offsets[target.column]!;
      const width = widths[target.column] ?? DEFAULT_WIDTH;
      if (x - element.scrollLeft < frozenWidth) element.scrollLeft = x - frozenWidth;
      else if (x + width > element.scrollLeft + element.clientWidth) element.scrollLeft = x + width - element.clientWidth;
    }
  }, [selection, positionOf, offsets, widths, frozenRows, frozenColumns, frozenHeight, frozenWidth]);

  const startRow = Math.max(frozenRows, Math.floor((view.top + frozenHeight - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN);
  const endRow = Math.min(rows.length - 1, Math.ceil((view.top + view.height) / ROW_HEIGHT) + OVERSCAN);
  const bodyPositions: number[] = [];
  for (let position = startRow; position <= endRow; position++) bodyPositions.push(position);
  for (const row of [active.row, editing?.row]) {
    const position = row === undefined ? undefined : positionOf.get(row);
    if (position !== undefined && position >= frozenRows && (position < startRow || position > endRow)) bodyPositions.push(position);
  }
  const visibleColumns: number[] = [];
  for (let column = frozenColumns; column < columnCount; column++) {
    const left = offsets[column]!;
    const right = offsets[column + 1]!;
    if (right >= view.left + frozenWidth - DEFAULT_WIDTH * 2 && left <= view.left + view.width + DEFAULT_WIDTH * 2) visibleColumns.push(column);
  }
  for (const column of [active.column, editing?.column]) {
    if (column !== undefined && column >= frozenColumns && !visibleColumns.includes(column)) visibleColumns.push(column);
  }
  const frozenColumnList = Array.from({ length: Math.min(frozenColumns, columnCount) }, (_, index) => index);

  /* ---------------- selection ---------------- */

  const select = (next: Selection, scroll: Point = next.focus) => {
    scrollTarget.current = scroll;
    setSelection(next);
  };
  const selectCell = (point: Point) => select({ anchor: point, focus: point, extra: [] });
  const hasValue = (row: number, column: number) => rawAt(row, column) !== "";

  const stepRow = (row: number, delta: number) => {
    const position = positionOf.get(row) ?? 0;
    const next = Math.min(rows.length - 1, Math.max(0, position + delta));
    return rows[next] ?? row;
  };

  const jump = (from: Point, dRow: number, dColumn: number): Point => {
    const along = (point: Point) => (dRow ? { row: stepRow(point.row, dRow), column: point.column } : { row: point.row, column: Math.min(columnCount - 1, Math.max(0, point.column + dColumn)) });
    let current = from;
    let next = along(current);
    if (next.row === current.row && next.column === current.column) return current;
    if (hasValue(current.row, current.column) && hasValue(next.row, next.column)) {
      while (hasValue(next.row, next.column)) {
        current = next;
        next = along(current);
        if (next.row === current.row && next.column === current.column) break;
      }
      return current;
    }
    while (!hasValue(next.row, next.column)) {
      current = next;
      next = along(current);
      if (next.row === current.row && next.column === current.column) return current;
    }
    return next;
  };

  const move = (dRow: number, dColumn: number, { extend = false, edge = false } = {}) => {
    const from = extend ? selection.focus : selection.anchor;
    const next = edge ? jump(from, dRow, dColumn) : { row: dRow ? stepRow(from.row, dRow) : from.row, column: Math.min(columnCount - 1, Math.max(0, from.column + dColumn)) };
    if (extend) select({ ...selection, focus: next, extra: selection.extra });
    else selectCell(next);
  };

  /* ---------------- editing ---------------- */

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });

  const startEdit = (initial?: string, source: Editing["source"] = "cell") => {
    if (readOnly) return;
    const original = rawAt(active.row, active.column);
    setSuggestion(0);
    updateEditing({ row: active.row, column: active.column, value: initial ?? original, original, source });
  };

  const commitEdit = (moveBy?: { dRow: number; dColumn: number }) => {
    const current = editingRef.current;
    if (!current) return;
    updateEditing(null);
    if (current.value !== current.original) updateSheet((item) => setCells(item, { [cellAddress(current.row, current.column)]: current.value }));
    if (moveBy) {
      const next = { row: moveBy.dRow ? stepRow(current.row, moveBy.dRow) : current.row, column: Math.max(0, current.column + moveBy.dColumn) };
      selectCell(next);
    }
    focusGrid();
  };

  const cancelEdit = () => {
    updateEditing(null);
    focusGrid();
  };

  const functionQuery = editing ? /(?:^=|[=(,+\-*/^&<>:\s])([A-Za-z][A-Za-z0-9.]*)$/.exec(editing.value)?.[1]?.toUpperCase() : undefined;
  const suggestions = editing?.value.startsWith("=") && functionQuery ? FORMULA_FUNCTIONS.filter((name) => name.startsWith(functionQuery) && name !== functionQuery)
          .sort((a, b) => a.length - b.length || a.localeCompare(b))
          .slice(0, 6) : [];
  const acceptSuggestion = (name: string) => {
    if (!editing || !functionQuery) return;
    updateEditing({ ...editing, value: `${editing.value.slice(0, editing.value.length - functionQuery.length)}${name}(` });
    setSuggestion(0);
  };

  const editorKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setSuggestion((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
      return;
    }
    if (suggestions.length > 0 && event.key === "Tab") {
      event.preventDefault();
      acceptSuggestion(suggestions[Math.min(suggestion, suggestions.length - 1)]!);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit({ dRow: event.shiftKey ? -1 : 1, dColumn: 0 });
    } else if (event.key === "Tab") {
      event.preventDefault();
      commitEdit({ dRow: 0, dColumn: event.shiftKey ? -1 : 1 });
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  /* ---------------- commands ---------------- */

  const applyFormat = (patch: CellFormat) => {
    if (readOnly) return;
    updateSheet((item) => ranges.reduce((acc, range) => formatRange(acc, { ...range, bottom: Math.min(range.bottom, rowCount - 1), right: Math.min(range.right, columnCount - 1) }, patch), item));
  };
  const activeFormat = formatAt(active.row, active.column) ?? {};

  const clearSelection = () => {
    if (readOnly) return;
    updateSheet((item) => ranges.reduce((acc, range) => clearRange(acc, range), item));
  };

  const fillDirection = (direction: "down" | "right") => {
    if (readOnly) return;
    const range = primary;
    if (direction === "down" && range.bottom > range.top) updateSheet((item) => fillRange(item, { ...range, bottom: range.top }, range, "down"));
    if (direction === "right" && range.right > range.left) updateSheet((item) => fillRange(item, { ...range, right: range.left }, range, "right"));
  };

  const sortBy = (direction: "asc" | "desc") => {
    if (readOnly || extent.rows <= headerRows) return;
    updateSheet((item) => sortRange(item, { top: headerRows, bottom: extent.rows - 1, left: 0, right: Math.max(0, extent.columns - 1) }, active.column, direction, valueAt));
    setNotice(`Sorted rows by column ${columnName(active.column)} ${direction === "asc" ? "A to Z" : "Z to A"}`);
  };

  const freeze = (rowsToFreeze: number, columnsToFreeze: number) => {
    if (readOnly) return;
    updateSheet((item) => ({ ...item, frozenRows: rowsToFreeze, frozenColumns: columnsToFreeze }));
  };

  const insert = (axis: "rows" | "columns", after: boolean) => {
    if (readOnly) return;
    const count = axis === "rows" ? primary.bottom - primary.top + 1 : primary.right - primary.left + 1;
    const at = axis === "rows" ? (after ? primary.bottom + 1 : primary.top) : after ? primary.right + 1 : primary.left;
    commit(insertAxis(sheets, sheetIndex, axis, at, count));
  };

  const remove = (axis: "rows" | "columns") => {
    if (readOnly) return;
    const count = axis === "rows" ? primary.bottom - primary.top + 1 : primary.right - primary.left + 1;
    const at = axis === "rows" ? primary.top : primary.left;
    commit(deleteAxis(sheets, sheetIndex, axis, at, count));
  };

  const resizeColumn = (column: number, width: number) => {
    const next = Math.max(MIN_WIDTH, Math.round(width));
    updateSheet((item) => ({ ...item, columnWidths: { ...item.columnWidths, [column]: next } }));
  };

  const autofit = (column: number) => {
    let widest = textWidth(columnName(column));
    for (let row = 0; row < extent.rows; row++) {
      const text = display(row, column);
      if (text) widest = Math.max(widest, textWidth(text));
    }
    resizeColumn(column, Math.min(480, widest + 20));
  };

  const copyText = (range: CellRange) => {
    const values: string[][] = [];
    for (let row = range.top; row <= range.bottom; row++) {
      const line: string[] = [];
      for (let column = range.left; column <= range.right; column++) line.push(display(row, column));
      values.push(line);
    }
    return values;
  };

  const captureClipboard = (cut: boolean) => {
    const range = { ...primary, bottom: Math.min(primary.bottom, Math.max(extent.rows - 1, primary.top)), right: Math.min(primary.right, Math.max(extent.columns - 1, primary.left)) };
    const values = copyText(range);
    const text = toDelimited(values, "\t");
    const html = `<table>${values.map((line) => `<tr>${line.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</table>`;
    clipboard.current = { text, block: readBlock(sheet, range), origin: { row: range.top, column: range.left }, cut };
    if (cut && !readOnly) updateSheet((item) => clearRange(item, range));
    return { text, html };
  };

  const pasteText = (text: string) => {
    if (readOnly) return;
    const normalized = text.replace(/\r\n/g, "\n").replace(/\n$/, "");
    const internal = clipboard.current && clipboard.current.text.replace(/\r\n/g, "\n") === normalized ? clipboard.current : null;
    const block = internal ? internal.block : parseDelimited(normalized, "\t");
    if (block.length === 0) return;
    const at = { row: primary.top, column: primary.left };
    const single = block.length === 1 && block[0]!.length === 1;
    if (single && (primary.bottom > primary.top || primary.right > primary.left)) {
      const raw = block[0]![0]!;
      updateSheet((item) => {
        let next = item;
        for (let row = primary.top; row <= primary.bottom; row++) {
          for (let column = primary.left; column <= primary.right; column++) next = writeBlock(next, { row, column }, [[raw]], internal && !internal.cut ? internal.origin : undefined);
        }
        return next;
      });
      return;
    }
    updateSheet((item) => writeBlock(item, at, block, internal && !internal.cut ? internal.origin : undefined));
    select({ anchor: at, focus: { row: at.row + block.length - 1, column: at.column + Math.max(...block.map((line) => line.length)) - 1 }, extra: [] }, at);
    if (internal?.cut) clipboard.current = null;
  };

  useEffect(() => {
    const owns = () => document.activeElement === gridRef.current && !editingRef.current;
    const onCopy = (event: ClipboardEvent) => {
      if (!owns() || !event.clipboardData) return;
      event.preventDefault();
      const { text, html } = captureClipboard(event.type === "cut");
      event.clipboardData.setData("text/plain", text);
      event.clipboardData.setData("text/html", html);
    };
    const onPaste = (event: ClipboardEvent) => {
      if (!owns() || !event.clipboardData) return;
      event.preventDefault();
      pasteText(event.clipboardData.getData("text/plain"));
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  });

  const clipboardAction = async (action: "copy" | "cut" | "paste") => {
    try {
      if (action === "paste") pasteText(await navigator.clipboard.readText());
      else await navigator.clipboard.writeText(captureClipboard(action === "cut").text);
    } catch {
      setNotice(`Use ${action === "paste" ? "Ctrl+V" : action === "cut" ? "Ctrl+X" : "Ctrl+C"} to ${action}; the browser blocked clipboard access.`);
    }
    focusGrid();
  };

  /* ---------------- keyboard ---------------- */

  const pageRows = Math.max(1, Math.floor((view.height - frozenHeight) / ROW_HEIGHT) - 1);

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;
    const handled = () => event.preventDefault();
    if (key.startsWith("Arrow") && event.altKey && event.shiftKey && (key === "ArrowLeft" || key === "ArrowRight")) {
      handled();
      if (!readOnly) resizeColumn(active.column, (widths[active.column] ?? DEFAULT_WIDTH) + (key === "ArrowRight" ? 16 : -16));
      return;
    }
    switch (key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight": {
        handled();
        const dRow = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
        const dColumn = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
        move(dRow, dColumn, { extend: event.shiftKey, edge: mod });
        return;
      }
      case "Tab":
        handled();
        move(0, event.shiftKey ? -1 : 1);
        return;
      case "Enter":
        handled();
        if (event.shiftKey) move(-1, 0);
        else startEdit();
        return;
      case "F2":
        handled();
        startEdit();
        return;
      case "Home":
        handled();
        if (mod) selectCell({ row: 0, column: 0 });
        else if (event.shiftKey) select({ ...selection, focus: { row: selection.focus.row, column: 0 } });
        else selectCell({ row: active.row, column: 0 });
        return;
      case "End": {
        handled();
        const last = mod ? { row: Math.max(0, extent.rows - 1), column: Math.max(0, extent.columns - 1) } : { row: active.row, column: Math.max(0, extent.columns - 1) };
        if (event.shiftKey) select({ ...selection, focus: last });
        else selectCell(last);
        return;
      }
      case "PageDown":
      case "PageUp":
        handled();
        move(key === "PageDown" ? pageRows : -pageRows, 0, { extend: event.shiftKey });
        return;
      case "Delete":
      case "Backspace":
        handled();
        clearSelection();
        return;
      case "Escape":
        if (selection.extra.length || primary.bottom !== primary.top || primary.right !== primary.left) {
          handled();
          selectCell(active);
        }
        return;
      case " ":
        if (event.shiftKey || mod) {
          handled();
          if (event.shiftKey) select({ anchor: { row: active.row, column: 0 }, focus: { row: active.row, column: columnCount - 1 }, extra: [] }, active);
          else select({ anchor: { row: 0, column: active.column }, focus: { row: rowCount - 1, column: active.column }, extra: [] }, active);
          return;
        }
        break;
    }
    if (mod) {
      const lower = key.toLowerCase();
      if (lower === "z") {
        handled();
        if (event.shiftKey) redo();
        else undo();
      } else if (lower === "y") {
        handled();
        redo();
      } else if (lower === "a") {
        handled();
        select({ anchor: { row: 0, column: 0 }, focus: { row: rowCount - 1, column: columnCount - 1 }, extra: [] }, active);
      } else if (lower === "b") {
        handled();
        applyFormat({ bold: !activeFormat.bold });
      } else if (lower === "i") {
        handled();
        applyFormat({ italic: !activeFormat.italic });
      } else if (lower === "d") {
        handled();
        fillDirection("down");
      } else if (lower === "r") {
        handled();
        fillDirection("right");
      }
      return;
    }
    if (key.length === 1 && !event.altKey && !readOnly) {
      handled();
      startEdit(key);
    }
  };

  /* ---------------- pointer ---------------- */

  const cellFromPoint = (x: number, y: number): Point | null => {
    const target = document.elementFromPoint?.(x, y)?.closest<HTMLElement>("[data-cell]");
    if (!target || !gridRef.current?.contains(target)) return null;
    return { row: Number(target.dataset.row), column: Number(target.dataset.column) };
  };

  const trackPointer = (onMove: (event: PointerEvent) => void, onUp: (event: PointerEvent) => void) => {
    const element = scrollRef.current;
    const handleMove = (event: PointerEvent) => {
      if (element) {
        const rect = element.getBoundingClientRect();
        if (event.clientY > rect.bottom - 16) element.scrollTop += 20;
        else if (event.clientY < rect.top + frozenHeight) element.scrollTop -= 20;
        if (event.clientX > rect.right - 16) element.scrollLeft += 20;
        else if (event.clientX < rect.left + frozenWidth) element.scrollLeft -= 20;
      }
      onMove(event);
    };
    const handleUp = (event: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      onUp(event);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input")) return;
    const fill = target.closest("[data-fill-handle]");
    const resize = target.closest<HTMLElement>("[data-resize]");
    const columnHeader = target.closest<HTMLElement>("[data-column-header]");
    const rowHeader = target.closest<HTMLElement>("[data-row-header]");
    const cell = target.closest<HTMLElement>("[data-cell]");
    if (event.button === 2) {
      if (cell && !isSelected(Number(cell.dataset.row), Number(cell.dataset.column))) selectCell({ row: Number(cell.dataset.row), column: Number(cell.dataset.column) });
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();

    if (editing && cell && editing.value.startsWith("=") && /[=+\-*/^&,(<>:]$/.test(editing.value.trimEnd())) {
      const address = cellAddress(Number(cell.dataset.row), Number(cell.dataset.column));
      updateEditing({ ...editing, value: `${editing.value}${address}` });
      return;
    }
    if (editing) commitEdit();
    focusGrid();

    if (resize) {
      if (readOnly) return;
      const column = Number(resize.dataset.resize);
      const startX = event.clientX;
      const startWidth = widths[column] ?? DEFAULT_WIDTH;
      let latest = startWidth;
      setResizing({ column, width: startWidth });
      trackPointer(
        (move) => {
          latest = Math.max(MIN_WIDTH, startWidth + move.clientX - startX);
          setResizing({ column, width: latest });
        },
        () => {
          setResizing(null);
          if (latest !== startWidth) resizeColumn(column, latest);
        },
      );
      return;
    }

    if (fill && !readOnly) {
      const source = primary;
      let latest: CellRange | null = null;
      trackPointer(
        (move) => {
          const point = cellFromPoint(move.clientX, move.clientY);
          if (!point) return;
          const down = point.row - source.bottom;
          const right = point.column - source.right;
          latest = down <= 0 && right <= 0 ? null : down >= right ? { ...source, bottom: point.row } : { ...source, right: point.column };
          setFillTarget(latest);
        },
        () => {
          setFillTarget(null);
          if (!latest) return;
          const direction = latest.bottom > source.bottom ? "down" : "right";
          const targetRange = latest;
          updateSheet((item) => fillRange(item, source, targetRange, direction));
          select({ anchor: selection.anchor, focus: { row: targetRange.bottom, column: targetRange.right }, extra: [] });
        },
      );
      return;
    }

    if (columnHeader) {
      const column = Number(columnHeader.dataset.columnHeader);
      const anchor = event.shiftKey ? { row: 0, column: selection.anchor.column } : { row: 0, column };
      select({ anchor, focus: { row: rowCount - 1, column }, extra: [] }, { row: active.row, column });
      return;
    }
    if (rowHeader) {
      const row = Number(rowHeader.dataset.rowHeader);
      const anchor = event.shiftKey ? { row: selection.anchor.row, column: 0 } : { row, column: 0 };
      select({ anchor, focus: { row, column: columnCount - 1 }, extra: [] }, { row, column: active.column });
      return;
    }
    if (target.closest("[data-corner]")) {
      select({ anchor: { row: 0, column: 0 }, focus: { row: rowCount - 1, column: columnCount - 1 }, extra: [] }, active);
      return;
    }
    if (!cell) return;
    const point = { row: Number(cell.dataset.row), column: Number(cell.dataset.column) };
    const base: Selection = event.shiftKey
      ? { ...selection, focus: point }
      : event.ctrlKey || event.metaKey
        ? { anchor: point, focus: point, extra: [...selection.extra, primary] }
        : { anchor: point, focus: point, extra: [] };
    select(base);
    trackPointer(
      (move) => {
        const next = cellFromPoint(move.clientX, move.clientY);
        if (next) setSelection((current) => ({ ...current, focus: next }));
      },
      () => undefined,
    );
  };

  /* ---------------- sheets ---------------- */

  const addSheet = () => {
    const created = createSpreadsheetSheet(nextSheetName(sheets), {}, sheets);
    commit([...sheets, created]);
    setActiveId(created.id);
    selectCell({ row: 0, column: 0 });
  };
  const switchSheet = (sheetId: string) => {
    if (editing) commitEdit();
    setActiveId(sheetId);
    setSelection({ anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 }, extra: [] });
  };
  const duplicateSheet = (sheetId: string) => {
    const source = sheets.find((item) => item.id === sheetId);
    if (!source) return;
    const copy = { ...createSpreadsheetSheet(nextSheetName(sheets, `${source.name.slice(0, 24)} copy `), {}, sheets), cells: { ...source.cells }, ...(source.formats ? { formats: { ...source.formats } } : {}), ...(source.columnWidths ? { columnWidths: { ...source.columnWidths } } : {}) };
    const index = sheets.indexOf(source);
    commit([...sheets.slice(0, index + 1), copy, ...sheets.slice(index + 1)]);
    setActiveId(copy.id);
  };
  const deleteSheet = (sheetId: string) => {
    if (sheets.length <= 1) return;
    const index = sheets.findIndex((item) => item.id === sheetId);
    const next = sheets.filter((item) => item.id !== sheetId);
    commit(next);
    setActiveId(next[Math.max(0, index - 1)]!.id);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const parsed = parseDelimited(text, detectDelimiter(text));
    updateSheet((item) => ({ ...item, cells: rowsToCells(parsed), formats: {} }));
    setNotice(`Imported ${Math.min(parsed.length, 5000)} rows from ${file.name}`);
  };

  const exportCsv = () => {
    downloadText(`${sheet.name}.csv`, `\uFEFF${toDelimited(sheetToRows(sheet, valueAt))}`, "text/csv;charset=utf-8");
  };

  /* ---------------- summary ---------------- */

  const summary = useMemo(() => {
    const current = normalizeRange(selection.anchor, selection.focus);
    if (current.top === current.bottom && current.left === current.right && selection.extra.length === 0) return null;
    let sum = 0;
    let count = 0;
    let filled = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const { row, column } of collectCells([...selection.extra, current], extent)) {
      const value = valueAt(row, column);
      if (value === null || value === "") continue;
      filled++;
      if (typeof value === "number") {
        sum += value;
        count++;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    return { sum, count, filled, min, max };
  }, [selection, valueAt, extent]);

  /* ---------------- render ---------------- */

  const cellId = (row: number, column: number) => `${id}-r${row}-c${column}`;
  const editingValue = editing && editing.row === active.row && editing.column === active.column ? editing.value : undefined;
  const barValue = editingValue ?? rawAt(active.row, active.column);
  const selectedColumns = new Set<number>();
  const selectedRows = new Set<number>();
  for (const range of ranges) {
    for (let column = range.left; column <= Math.min(range.right, columnCount - 1); column++) selectedColumns.add(column);
    if (range.bottom - range.top < 5000) for (let row = range.top; row <= range.bottom; row++) selectedRows.add(row);
  }
  const columnValues = (column: number) => {
    const values = new Set<string>();
    for (let row = headerRows; row < extent.rows; row++) values.add(displayCellValue(valueAt(row, column)));
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  const renderCell = (row: number, column: number, frozenColumn: boolean) => {
    const value = valueAt(row, column);
    const format = formatAt(row, column);
    const isActive = row === active.row && column === active.column;
    const selected = isSelected(row, column);
    const inFill = fillTarget ? inRange(fillTarget, row, column) && !inRange(primary, row, column) : false;
    const text = display(row, column);
    const align = format?.align ?? (typeof value === "number" ? "right" : typeof value === "boolean" || isFormulaError(value) ? "center" : "left");
    const isEditing = editing?.source === "cell" && editing.row === row && editing.column === column;
    const width = widths[column] ?? DEFAULT_WIDTH;
    const showFill = !readOnly && !editing && selection.extra.length === 0 && row === primary.bottom && column === primary.right && primary.bottom - primary.top < rowCount - 1;
    return (
      <div
        key={column}
        id={cellId(row, column)}
        role="gridcell"
        aria-colindex={column + 2}
        aria-selected={selected}
        aria-readonly={readOnly || undefined}
        data-cell=""
        data-row={row}
        data-column={column}
        data-active={isActive || undefined}
        className={cn(
          "h-full border-r border-b border-border px-1.5 leading-[27px] tabular-nums",
          isEditing ? "overflow-visible" : "truncate",
          frozenColumn ? "sticky z-20 bg-background" : "absolute top-0 bg-background",
          selected && "bg-[color-mix(in_oklab,var(--primary)_12%,var(--background))]",
          inFill && "bg-[color-mix(in_oklab,var(--primary)_6%,var(--background))] outline-1 -outline-offset-1 outline-dashed outline-primary",
          isActive && (frozenColumn ? "z-[21]" : "z-10"),
          isActive && "outline-2 -outline-offset-2 outline-primary",
          isFormulaError(value) && "text-destructive",
          format?.bold && "font-semibold",
          format?.italic && "italic",
          align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        )}
        style={{ width, left: offsets[column] }}
        title={text.length * 7 > width ? text : undefined}
      >
        {isEditing ? (
          <input
            ref={(element) => {
              if (element && document.activeElement !== element) {
                element.focus({ preventScroll: true });
                element.setSelectionRange(element.value.length, element.value.length);
              }
            }}
            aria-label={`Edit ${cellAddress(row, column)}`}
            aria-autocomplete="list"
            aria-controls={suggestions.length ? `${id}-functions` : undefined}
            aria-activedescendant={suggestions.length ? `${id}-fn-${Math.min(suggestion, suggestions.length - 1)}` : undefined}
            value={editing.value}
            spellCheck={false}
            onChange={(event) => {
              updateEditing({ ...editing, value: event.target.value });
              setSuggestion(0);
            }}
            onKeyDown={editorKeyDown}
            onBlur={() => editingRef.current && commitEdit()}
            className="absolute inset-y-0 left-0 z-30 h-full min-w-full bg-background px-1.5 text-left outline-2 -outline-offset-2 outline-primary"
            style={{ width: Math.min(480, Math.max(width, editing.value.length * 8 + 24)) }}
          />
        ) : isEditing === false && editing && editing.row === row && editing.column === column ? (
          editing.value
        ) : (
          text
        )}
        {showFill && <span data-fill-handle="" aria-hidden="true" className="absolute right-0 bottom-0 z-30 size-2 translate-x-px translate-y-px cursor-crosshair border border-background bg-primary" />}
      </div>
    );
  };

  const renderRow = (row: number, position: number, sticky: boolean) => (
    <div
      key={row}
      role="row"
      aria-rowindex={row + 2}
      className={cn("flex", sticky ? "sticky z-30" : "absolute left-0 z-0")}
      style={{ top: HEADER_HEIGHT + position * ROW_HEIGHT, height: ROW_HEIGHT, width: totalWidth }}
    >
      <div
        role="rowheader"
        data-row-header={row}
        className={cn(
          "sticky left-0 z-[22] flex h-full shrink-0 items-center justify-center border-r border-b border-border bg-muted text-xs text-muted-foreground tabular-nums select-none",
          selectedRows.has(row) && "bg-accent font-medium text-foreground",
        )}
        style={{ width: ROW_HEADER_WIDTH }}
      >
        {row + 1}
      </div>
      {frozenColumnList.map((column) => renderCell(row, column, true))}
      {visibleColumns.map((column) => renderCell(row, column, false))}
    </div>
  );

  const structureItems: MenuEntry[] = [
    { id: "row-above", label: "Insert row above", disabled: readOnly, onSelect: () => insert("rows", false) },
    { id: "row-below", label: "Insert row below", disabled: readOnly, onSelect: () => insert("rows", true) },
    { id: "col-left", label: "Insert column left", disabled: readOnly, onSelect: () => insert("columns", false) },
    { id: "col-right", label: "Insert column right", disabled: readOnly, onSelect: () => insert("columns", true) },
    { type: "separator", id: "s2" },
    { id: "delete-rows", label: primary.bottom > primary.top ? `Delete rows ${primary.top + 1}–${primary.bottom + 1}` : `Delete row ${primary.top + 1}`, destructive: true, disabled: readOnly, onSelect: () => remove("rows") },
    { id: "delete-columns", label: primary.right > primary.left ? `Delete columns ${columnName(primary.left)}–${columnName(primary.right)}` : `Delete column ${columnName(primary.left)}`, destructive: true, disabled: readOnly, onSelect: () => remove("columns") },
  ];
  const contextItems: MenuEntry[] = [
    { id: "cut", label: "Cut", shortcut: "Ctrl+X", disabled: readOnly, onSelect: () => void clipboardAction("cut") },
    { id: "copy", label: "Copy", shortcut: "Ctrl+C", onSelect: () => void clipboardAction("copy") },
    { id: "paste", label: "Paste", shortcut: "Ctrl+V", disabled: readOnly, onSelect: () => void clipboardAction("paste") },
    { type: "separator", id: "s1" },
    ...structureItems,
    { id: "clear", label: "Clear contents", shortcut: "Delete", disabled: readOnly, onSelect: clearSelection },
    { type: "separator", id: "s3" },
    { id: "sort-asc", label: `Sort by ${columnName(active.column)}, A to Z`, disabled: readOnly, onSelect: () => sortBy("asc") },
    { id: "sort-desc", label: `Sort by ${columnName(active.column)}, Z to A`, disabled: readOnly, onSelect: () => sortBy("desc") },
  ];

  const toolButton = cn("inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-accent aria-pressed:text-foreground [&_svg]:size-4", focusRing);
  const filterAllowed = sheetFilters[active.column];

  return (
    <div data-slot="spreadsheet" className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-background text-sm text-foreground", className)} {...props}>
      {!hideToolbar && (
        <Toolbar.Root aria-label="Spreadsheet tools" className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
          <Toolbar.Button aria-label="Undo" disabled={history.past.length === 0} onClick={undo} className={toolButton}>
            <Undo2Icon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Redo" disabled={history.future.length === 0} onClick={redo} className={toolButton}>
            <Redo2Icon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
          <Toolbar.Button aria-label="Bold" aria-pressed={Boolean(activeFormat.bold)} disabled={readOnly} onClick={() => applyFormat({ bold: !activeFormat.bold })} className={toolButton}>
            <BoldIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Italic" aria-pressed={Boolean(activeFormat.italic)} disabled={readOnly} onClick={() => applyFormat({ italic: !activeFormat.italic })} className={toolButton}>
            <ItalicIcon aria-hidden="true" />
          </Toolbar.Button>
          {(["left", "center", "right"] as const).map((align) => (
            <Toolbar.Button key={align} aria-label={`Align ${align}`} aria-pressed={activeFormat.align === align} disabled={readOnly} onClick={() => applyFormat({ align: activeFormat.align === align ? undefined : align })} className={toolButton}>
              {align === "left" ? <AlignLeftIcon aria-hidden="true" /> : align === "center" ? <AlignCenterIcon aria-hidden="true" /> : <AlignRightIcon aria-hidden="true" />}
            </Toolbar.Button>
          ))}
          <ActionMenu
            trigger={
              <Toolbar.Button disabled={readOnly} className={cn(toolButton, "w-auto gap-1 px-2 text-xs")}>
                {NUMBER_FORMATS.find((item) => item.value === (activeFormat.numberFormat ?? "general"))?.label.split(" ")[0]}
                <span className="sr-only"> number format</span>
              </Toolbar.Button>
            }
            items={NUMBER_FORMATS.map((item) => ({ id: item.value, label: item.label, checked: (activeFormat.numberFormat ?? "general") === item.value, onSelect: () => applyFormat({ numberFormat: item.value === "general" ? undefined : item.value }) }))}
          />
          <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
          <Toolbar.Button aria-label={`Sort by column ${columnName(active.column)}, A to Z`} disabled={readOnly} onClick={() => sortBy("asc")} className={toolButton}>
            <ArrowDownAZIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label={`Sort by column ${columnName(active.column)}, Z to A`} disabled={readOnly} onClick={() => sortBy("desc")} className={toolButton}>
            <ArrowUpAZIcon aria-hidden="true" />
          </Toolbar.Button>
          <ValueFilter
            columnLabel={columnName(active.column)}
            values={columnValues(active.column)}
            allowed={filterAllowed}
            onApply={(allowed) =>
              setFilters((current) => {
                const next = { ...current[sheet.id] };
                if (allowed) next[active.column] = allowed;
                else delete next[active.column];
                return { ...current, [sheet.id]: next };
              })
            }
            trigger={
              <Toolbar.Button aria-label={`Filter column ${columnName(active.column)}`} aria-pressed={Boolean(filterAllowed)} className={toolButton}>
                <FilterIcon aria-hidden="true" />
              </Toolbar.Button>
            }
          />
          <ActionMenu
            trigger={
              <Toolbar.Button aria-label="Freeze" disabled={readOnly} className={toolButton}>
                <SnowflakeIcon aria-hidden="true" />
              </Toolbar.Button>
            }
            items={[
              { id: "none", label: "No frozen rows or columns", checked: frozenRows === 0 && frozenColumns === 0, onSelect: () => freeze(0, 0) },
              { id: "row1", label: "Freeze 1 row", checked: frozenRows === 1 && frozenColumns === 0, onSelect: () => freeze(1, 0) },
              { id: "row2", label: "Freeze 2 rows", checked: frozenRows === 2 && frozenColumns === 0, onSelect: () => freeze(2, 0) },
              { id: "col1", label: "Freeze 1 column", checked: frozenRows === 0 && frozenColumns === 1, onSelect: () => freeze(0, 1) },
              { id: "both", label: "Freeze 1 row and 1 column", checked: frozenRows === 1 && frozenColumns === 1, onSelect: () => freeze(1, 1) },
              { id: "here", label: `Freeze up to ${cellAddress(active.row, active.column)}`, onSelect: () => freeze(active.row, active.column) },
            ]}
          />
          <ActionMenu
            trigger={
              <Toolbar.Button aria-label="Rows and columns" disabled={readOnly} className={toolButton}>
                <TableRowsSplitIcon aria-hidden="true" />
              </Toolbar.Button>
            }
            items={structureItems}
          />
          <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
          {!readOnly && (
            <Toolbar.Button aria-label="Import CSV" onClick={() => fileRef.current?.click()} className={toolButton}>
              <UploadIcon aria-hidden="true" />
            </Toolbar.Button>
          )}
          <Toolbar.Button aria-label="Download CSV" onClick={exportCsv} className={toolButton}>
            <DownloadIcon aria-hidden="true" />
          </Toolbar.Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importCsv(file);
            }}
          />
        </Toolbar.Root>
      )}
      <div className="relative flex items-center gap-2 border-b border-border px-2 py-1">
        <span aria-label="Selected range" className="w-20 shrink-0 rounded border border-border px-1.5 py-0.5 text-center font-mono text-xs">
          {ranges.length > 1 ? `${ranges.length} ranges` : rangeAddress(primary)}
        </span>
        <span aria-hidden="true" className="text-xs text-muted-foreground italic">
          fx
        </span>
        <input
          aria-label={`Contents of ${cellAddress(active.row, active.column)}`}
          aria-autocomplete="list"
          aria-controls={suggestions.length && editing?.source === "bar" ? `${id}-functions` : undefined}
          readOnly={readOnly}
          spellCheck={false}
          value={editing?.source === "bar" ? editing.value : barValue}
          onFocus={() => !readOnly && !editing && startEdit(undefined, "bar")}
          onChange={(event) => {
            const value = event.target.value;
            const current = editingRef.current;
            updateEditing(current ? { ...current, value } : { row: active.row, column: active.column, value, original: rawAt(active.row, active.column), source: "bar" });
            setSuggestion(0);
          }}
          onKeyDown={editorKeyDown}
          onBlur={() => editingRef.current?.source === "bar" && commitEdit()}
          className={cn("h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 font-mono text-xs hover:border-border focus:border-input", focusRing)}
        />
        {suggestions.length > 0 && (
          <ul id={`${id}-functions`} role="listbox" aria-label="Functions" className="absolute top-full left-24 z-50 mt-1 flex flex-col rounded-md border border-border bg-popover p-1 text-xs text-popover-foreground shadow-md">
            {suggestions.map((name, index) => (
              <li
                key={name}
                id={`${id}-fn-${index}`}
                role="option"
                aria-selected={index === Math.min(suggestion, suggestions.length - 1)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  acceptSuggestion(name);
                }}
                className="cursor-default rounded px-2 py-1 font-mono aria-selected:bg-accent"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ActionContextMenu items={contextItems} className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          role="tabpanel"
          id={`${id}-panel`}
          aria-label={sheet.name}
          onScroll={(event) => {
            const element = event.currentTarget;
            setView((current) => ({ ...current, top: element.scrollTop, left: element.scrollLeft }));
          }}
          className="relative overflow-auto overscroll-contain"
          style={{ height }}
        >
          <div
            ref={gridRef}
            role="grid"
            tabIndex={0}
            aria-label={`${label}: ${sheet.name}`}
            aria-rowcount={rows.length + 1}
            aria-colcount={columnCount + 1}
            aria-multiselectable="true"
            aria-readonly={readOnly || undefined}
            aria-activedescendant={cellId(active.row, active.column)}
            onKeyDown={onGridKeyDown}
            onPointerDown={onPointerDown}
            onDoubleClick={(event) => {
              const target = event.target as HTMLElement;
              const resize = target.closest<HTMLElement>("[data-resize]");
              if (resize && !readOnly) autofit(Number(resize.dataset.resize));
              else if (target.closest("[data-cell]")) startEdit();
            }}
            className="relative outline-none select-none focus-visible:outline-none"
            style={{ width: totalWidth, height: totalHeight }}
          >
            <div role="row" aria-rowindex={1} className="sticky top-0 z-40 flex" style={{ height: HEADER_HEIGHT, width: totalWidth }}>
              <div data-corner="" role="columnheader" aria-label="Select all" className="sticky left-0 z-50 h-full shrink-0 border-r border-b border-border bg-muted" style={{ width: ROW_HEADER_WIDTH }} />
              {[...frozenColumnList, ...visibleColumns].map((column) => (
                <div
                  key={column}
                  role="columnheader"
                  aria-colindex={column + 2}
                  data-column-header={column}
                  className={cn(
                    "flex h-full items-center justify-center border-r border-b border-border bg-muted text-xs text-muted-foreground select-none",
                    column < frozenColumns ? "sticky z-50" : "absolute top-0",
                    selectedColumns.has(column) && "bg-accent font-medium text-foreground",
                  )}
                  style={{ width: widths[column], left: offsets[column] }}
                >
                  {columnName(column)}
                  {sheetFilters[column] && <FilterIcon aria-label="Filtered" className="ml-1 size-3" />}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize column ${columnName(column)}`}
                    aria-valuenow={Math.round(widths[column] ?? DEFAULT_WIDTH)}
                    aria-valuemin={MIN_WIDTH}
                    aria-valuemax={1000}
                    tabIndex={-1}
                    data-resize={column}
                    className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize hover:bg-primary/40"
                  />
                </div>
              ))}
            </div>
            {rows.slice(0, frozenRows).map((row, position) => renderRow(row, position, true))}
            {bodyPositions.map((position) => {
              const row = rows[position];
              return row === undefined ? null : renderRow(row, position, false);
            })}
          </div>
        </div>
      </ActionContextMenu>
      <div className="flex min-h-7 flex-wrap items-center gap-x-4 border-t border-border px-2 py-1 text-xs text-muted-foreground tabular-nums">
        {summary && summary.count > 0 ? (
          <>
            <span>Sum: {displayCellValue(summary.sum)}</span>
            <span>Average: {displayCellValue(summary.sum / summary.count)}</span>
            <span>Count: {summary.filled}</span>
            <span>Min: {displayCellValue(summary.min)}</span>
            <span>Max: {displayCellValue(summary.max)}</span>
          </>
        ) : summary ? (
          <span>Count: {summary.filled}</span>
        ) : (
          <span>{rangeAddress(primary)}</span>
        )}
        {filterEntries.length > 0 && <span>{extent.rows - (rows.filter((row) => row < extent.rows).length)} rows hidden by filters</span>}
        <span role="status" className="ml-auto">
          {notice}
        </span>
      </div>
      <SheetTabs
        sheets={sheets}
        activeId={sheet.id}
        readOnly={readOnly}
        panelId={`${id}-panel`}
        onSelect={switchSheet}
        onAdd={addSheet}
        onRename={(sheetId, name) => commit(renameSheet(sheets, sheets.findIndex((item) => item.id === sheetId), name))}
        onDuplicate={duplicateSheet}
        onDelete={deleteSheet}
      />
    </div>
  );
}
