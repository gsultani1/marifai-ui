// packages/ai-ui/src/lib/rich-text/html-media.ts
import { Fragment, type Node as ProseMirrorNode, NodeRange, Slice } from "prosemirror-model";
import { type Command, type EditorState, NodeSelection, Plugin, PluginKey, Selection, TextSelection, type Transaction } from "prosemirror-state";
import { CellSelection, columnResizing, isInTable, selectedRect, selectionCell, type TableMap } from "prosemirror-tables";
import { findWrapping, liftTarget, ReplaceAroundStep } from "prosemirror-transform";
import { Decoration, DecorationSet, type EditorView, type NodeView } from "prosemirror-view";

import { HTML_EDITOR_PROPS_META } from "../../components/html-editor-extension.js";
import { CALLOUT_TONES, type CalloutTone, FIGURE_ALIGNS, type FigureAlign, safeCssColor } from "./html.js";

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

/** Narrowest width, in pixels, that resizing a figure allows. */
export const FIGURE_MIN_WIDTH = 80;
const FIGURE_MAX_WIDTH = 4000;

export interface FigureSizePreset {
  id: "small" | "medium" | "large" | "original";
  label: string;
  /** Width in pixels, or null for the image's own size. */
  width: number | null;
}

/** Width presets in the figure toolbar. */
export const FIGURE_SIZE_PRESETS: readonly FigureSizePreset[] = [
  { id: "small", label: "Small", width: 240 },
  { id: "medium", label: "Medium", width: 400 },
  { id: "large", label: "Large", width: 640 },
  { id: "original", label: "Original", width: null },
];

export interface FoundNode {
  pos: number;
  node: ProseMirrorNode;
}

/** The figure selected as a whole (by clicking its image), if any. */
export function selectedFigure(state: EditorState): FoundNode | null {
  const { selection } = state;
  return selection instanceof NodeSelection && selection.node.type.name === "figure" ? { pos: selection.from, node: selection.node } : null;
}

/** The figure whose caption holds the cursor or a text selection, if any. */
export function captionFigure(state: EditorState): FoundNode | null {
  const { selection } = state;
  const { $from, $to } = selection;
  if (!(selection instanceof TextSelection) || $from.parent.type.name !== "figure" || !$from.sameParent($to)) return null;
  return { pos: $from.before(), node: $from.parent };
}

/** A width between FIGURE_MIN_WIDTH and `max`, rounded to whole pixels. */
export function clampFigureWidth(width: number, max: number = FIGURE_MAX_WIDTH): number {
  return Math.round(Math.min(Math.max(width, FIGURE_MIN_WIDTH), Math.max(FIGURE_MIN_WIDTH, Math.min(max, FIGURE_MAX_WIDTH))));
}

/**
 * The next width when resizing from the keyboard: one tenth of the
 * available width per step, up to the available width (half of it for
 * floated figures, as published). Without a measured width it steps by a
 * tenth of the current width.
 */
export function steppedFigureWidth(current: number, available: number, direction: 1 | -1, floated = false): number {
  if (available <= 0) return clampFigureWidth(current + direction * Math.max(current, FIGURE_MIN_WIDTH) * 0.1);
  return clampFigureWidth(current + direction * available * 0.1, floated ? available / 2 : available);
}

function cleanAlt(text: string): string {
  return text
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

export interface FigurePatch {
  align?: FigureAlign;
  /** Pixels, or null for the image's own size. A width moves a wide figure to the center. */
  width?: number | null;
  /** Text alternative; "" marks the image as decorative. */
  alt?: string;
}

/** Changes the figure at `pos`; keeps it selected when it was. False when nothing would change. */
export function updateFigure(pos: number, patch: FigurePatch): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type.name !== "figure") return false;
    const attrs: Record<string, unknown> = { ...node.attrs };
    if (patch.align !== undefined) {
      if (!FIGURE_ALIGNS.includes(patch.align)) return false;
      attrs.align = patch.align;
    }
    if (patch.width !== undefined) {
      attrs.width = patch.width === null ? null : clampFigureWidth(patch.width);
      if (attrs.width !== null && attrs.align === "wide" && patch.align === undefined) attrs.align = "center";
    }
    if (patch.alt !== undefined) attrs.alt = cleanAlt(patch.alt);
    if (Object.keys(attrs).every((key) => attrs[key] === node.attrs[key])) return false;
    if (dispatch) {
      const tr = state.tr.setNodeMarkup(pos, undefined, attrs);
      if (state.selection instanceof NodeSelection && state.selection.from === pos) tr.setSelection(NodeSelection.create(tr.doc, pos));
      dispatch(tr);
    }
    return true;
  };
}

function targetFigure(state: EditorState): FoundNode | null {
  return selectedFigure(state) ?? captionFigure(state);
}

/** Aligns the selected figure (or the one whose caption has the cursor). */
export function setFigureAlign(align: FigureAlign): Command {
  return (state, dispatch, view) => {
    const figure = targetFigure(state);
    return figure ? updateFigure(figure.pos, { align })(state, dispatch, view) : false;
  };
}

/** Sizes the selected figure (or the one whose caption has the cursor); null restores the image's own size. */
export function setFigureWidth(width: number | null): Command {
  return (state, dispatch, view) => {
    const figure = targetFigure(state);
    return figure ? updateFigure(figure.pos, { width })(state, dispatch, view) : false;
  };
}

/** The size preset matching a width, or null for a custom width. */
export function figureSizePreset(width: number | null): FigureSizePreset | null {
  return FIGURE_SIZE_PRESETS.find((preset) => preset.width === width) ?? null;
}

/* ------------------------------------------------------------------ */
/* Callouts                                                            */
/* ------------------------------------------------------------------ */

/** Names for each callout tone, as menus and buttons show them. */
export const CALLOUT_TONE_LABELS: Record<CalloutTone, string> = { info: "Info", note: "Note", success: "Success", warning: "Warning", danger: "Danger" };

function ancestor(state: EditorState, name: string): FoundNode | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === name) return { pos: selection.from, node: selection.node };
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === name) return { pos: $from.before(depth), node };
  }
  return null;
}

function nodeAt(state: EditorState, pos: number | undefined, name: string, fallback: () => FoundNode | null): FoundNode | null {
  if (pos === undefined) return fallback();
  const node = state.doc.nodeAt(pos);
  return node && node.type.name === name ? { pos, node } : null;
}

/** The innermost callout around the selection. */
export function calloutAround(state: EditorState): FoundNode | null {
  return ancestor(state, "callout");
}

/** Sets the tone of the callout at `pos`. */
export function setCalloutTone(pos: number, tone: CalloutTone): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type.name !== "callout" || !CALLOUT_TONES.includes(tone)) return false;
    if (dispatch && node.attrs.tone !== tone) dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, tone }));
    return true;
  };
}

/**
 * Wraps the current block, or the selected blocks, in a callout of `tone`.
 * Inside a callout it changes that callout's tone instead. Where a callout
 * can't go (inside a list item, say), the nearest enclosing block that can
 * hold one is wrapped.
 */
export function wrapInCallout(tone: CalloutTone = "info"): Command {
  return (state, dispatch, view) => {
    const type = state.schema.nodes.callout;
    if (!type || !CALLOUT_TONES.includes(tone)) return false;
    const existing = calloutAround(state);
    if (existing) return setCalloutTone(existing.pos, tone)(state, dispatch, view);
    const { $from, $to } = state.selection;
    let range = $from.blockRange($to);
    while (range) {
      const wrapping = findWrapping(range, type, { tone });
      if (wrapping) {
        if (dispatch) dispatch(state.tr.wrap(range, wrapping).scrollIntoView());
        return true;
      }
      range = range.depth > 0 ? new NodeRange(range.$from, range.$to, range.depth - 1) : null;
    }
    return false;
  };
}

/** Removes the callout at `pos` (or around the selection), keeping its content in place. */
export function unwrapCallout(pos?: number): Command {
  return (state, dispatch) => {
    const found = nodeAt(state, pos, "callout", () => calloutAround(state));
    if (!found) return false;
    const $start = state.doc.resolve(found.pos + 1);
    const $end = state.doc.resolve(found.pos + found.node.nodeSize - 1);
    const range = new NodeRange($start, $end, $start.depth);
    const target = liftTarget(range);
    if (target === null) return false;
    if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView());
    return true;
  };
}

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

const MAX_COLUMNS = 3;
const NOT_COLUMN_PARENTS = new Set(["list_item", "task_item", "table_cell", "table_header"]);

/** The innermost column layout around the selection. */
export function columnsAround(state: EditorState): FoundNode | null {
  return ancestor(state, "columns");
}

/** Which column of the layout at `pos` holds the cursor, or null when it is elsewhere. */
export function columnIndexAt(state: EditorState, pos: number): number | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.before(depth) === pos && $from.node(depth).type.name === "columns") return $from.index(depth);
  }
  return null;
}

function isEmptyColumn(column: ProseMirrorNode): boolean {
  let empty = true;
  column.forEach((child) => {
    if (child.type.name !== "paragraph" || child.content.size > 0) empty = false;
  });
  return empty;
}

function layoutAt(state: EditorState, pos: number | undefined): FoundNode | null {
  return nodeAt(state, pos, "columns", () => columnsAround(state));
}

/**
 * Puts the current block (or the selected blocks) in the first column of a
 * new two or three column layout; the other columns start empty. Inside a
 * layout it changes that layout's column count instead.
 */
export function insertColumns(count: 2 | 3): Command {
  return (state, dispatch, view) => {
    const { columns, column, paragraph } = state.schema.nodes;
    if (!columns || !column || !paragraph) return false;
    const existing = columnsAround(state);
    if (existing) return setLayoutColumnCount(existing.pos, count)(state, dispatch, view);
    const { $from, $to } = state.selection;
    let range = $from.blockRange($to);
    while (range && (NOT_COLUMN_PARENTS.has(range.parent.type.name) || !range.parent.canReplaceWith(range.startIndex, range.endIndex, columns))) {
      range = range.depth > 0 ? new NodeRange(range.$from, range.$to, range.depth - 1) : null;
    }
    if (!range) return false;
    const empties = Array.from({ length: count - 1 }, () => column.create(null, paragraph.create()));
    const layout = columns.create(null, [column.create(), ...empties]);
    const tr = state.tr;
    if (tr.maybeStep(new ReplaceAroundStep(range.start, range.end, range.start, range.end, new Slice(Fragment.from(layout), 0, 0), 2, true)).failed) return false;
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Adds an empty column after column `after` (by default the last) and puts the cursor in it. At most three columns. */
export function addColumn(pos?: number, after?: number): Command {
  return (state, dispatch) => {
    const found = layoutAt(state, pos);
    const { column, paragraph } = state.schema.nodes;
    if (!found || !column || !paragraph || found.node.childCount >= MAX_COLUMNS) return false;
    const index = Math.max(0, Math.min(after ?? found.node.childCount - 1, found.node.childCount - 1));
    let insertAt = found.pos + 1;
    for (let i = 0; i <= index; i++) insertAt += found.node.child(i).nodeSize;
    if (dispatch) {
      const tr = state.tr.insert(insertAt, column.create(null, paragraph.create()));
      tr.setSelection(TextSelection.create(tr.doc, insertAt + 2));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/**
 * Removes column `index` from a three column layout. Its content moves to
 * the end of the column before it (or the start of the next one), so
 * nothing is lost. Two column layouts keep both columns; use
 * unwrapColumns to remove the layout.
 */
export function removeColumn(pos: number | undefined, index: number): Command {
  return (state, dispatch) => {
    const found = layoutAt(state, pos);
    if (!found || found.node.childCount <= 2 || index < 0 || index >= found.node.childCount) return false;
    if (dispatch) {
      const { node } = found;
      const removed = node.child(index);
      const target = index > 0 ? index - 1 : 1;
      const children: ProseMirrorNode[] = [];
      node.forEach((child, _offset, i) => {
        if (i === index) return;
        if (i !== target || isEmptyColumn(removed)) children.push(child);
        else children.push(child.copy(index > 0 ? child.content.append(removed.content) : removed.content.append(child.content)));
      });
      const layout = node.copy(Fragment.fromArray(children));
      const inside = columnIndexAt(state, found.pos) !== null;
      const tr = state.tr.replaceWith(found.pos, found.pos + node.nodeSize, layout);
      if (inside) {
        const targetIndex = index > 0 ? index - 1 : 0;
        let end = found.pos + 1;
        for (let i = 0; i <= targetIndex; i++) end += layout.child(i).nodeSize;
        tr.setSelection(Selection.near(tr.doc.resolve(end - 1), -1));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Changes a layout to `count` columns, adding empty ones or folding the last one into its neighbor. */
export function setLayoutColumnCount(pos: number, count: 2 | 3): Command {
  return (state, dispatch, view) => {
    const found = layoutAt(state, pos);
    if (!found) return false;
    if (found.node.childCount === count) return true;
    return count > found.node.childCount ? addColumn(pos)(state, dispatch, view) : removeColumn(pos, found.node.childCount - 1)(state, dispatch, view);
  };
}

/** Removes the layout at `pos` (or around the selection), putting each column's content back in order. Empty columns are dropped. */
export function unwrapColumns(pos?: number): Command {
  return (state, dispatch) => {
    const found = layoutAt(state, pos);
    const paragraph = state.schema.nodes.paragraph;
    if (!found || !paragraph) return false;
    if (dispatch) {
      const parts: Array<{ start: number; content: Fragment; keptBefore: number }> = [];
      let kept = 0;
      found.node.forEach((column, offset) => {
        if (isEmptyColumn(column)) return;
        parts.push({ start: found.pos + 1 + offset + 1, content: column.content, keptBefore: kept });
        kept += column.content.size;
      });
      const nodes: ProseMirrorNode[] = [];
      for (const part of parts) part.content.forEach((child) => nodes.push(child));
      const tr = state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, nodes.length ? nodes : paragraph.create());
      const remap = (position: number): number | null => {
        const part = parts.find((item) => position >= item.start && position <= item.start + item.content.size);
        return part ? found.pos + part.keptBefore + (position - part.start) : null;
      };
      const { selection } = state;
      const inside = selection.from > found.pos && selection.to < found.pos + found.node.nodeSize;
      if (inside) {
        const anchor = remap(selection.anchor);
        const head = remap(selection.head);
        if (selection instanceof TextSelection && anchor !== null && head !== null) tr.setSelection(TextSelection.create(tr.doc, anchor, head));
        else tr.setSelection(Selection.near(tr.doc.resolve(Math.min(found.pos + 1, tr.doc.content.size))));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/* ------------------------------------------------------------------ */
/* Table cells and columns                                             */
/* ------------------------------------------------------------------ */

export interface CellColor {
  name: string;
  value: string;
}

/** Cell background swatches: light tints that keep dark text readable. */
export const CELL_COLORS: readonly CellColor[] = [
  { name: "Gray", value: "#f4f4f5" },
  { name: "Red", value: "#fee2e2" },
  { name: "Orange", value: "#ffedd5" },
  { name: "Yellow", value: "#fef3c7" },
  { name: "Green", value: "#dcfce7" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Purple", value: "#ede9fe" },
  { name: "Pink", value: "#fce7f3" },
];

function selectedCells(state: EditorState): FoundNode[] {
  if (state.selection instanceof CellSelection) {
    const cells: FoundNode[] = [];
    state.selection.forEachCell((node, pos) => cells.push({ node, pos }));
    return cells;
  }
  if (!isInTable(state)) return [];
  const $cell = selectionCell(state);
  return $cell.nodeAfter ? [{ pos: $cell.pos, node: $cell.nodeAfter }] : [];
}

/** How many table cells a cell command would change. */
export function selectedCellCount(state: EditorState): number {
  return selectedCells(state).length;
}

/** The background shared by the selected cells; `mixed` when they differ. */
export function currentCellBackground(state: EditorState): { value: string | null; mixed: boolean } {
  const values = new Set(selectedCells(state).map((cell) => (cell.node.attrs.background as string | null) ?? null));
  if (values.size > 1) return { value: null, mixed: true };
  return { value: values.values().next().value ?? null, mixed: false };
}

/** Sets the background of every selected cell (or the cell with the cursor); null removes it. Rejects unsafe colors. */
export function setCellBackground(color: string | null): Command {
  return (state, dispatch) => {
    const value = color === null ? null : safeCssColor(color);
    if (color !== null && !value) return false;
    const cells = selectedCells(state);
    if (!cells.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const cell of cells) {
        if (cell.node.attrs.background !== value) tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, background: value });
      }
      dispatch(tr);
    }
    return true;
  };
}

/** Narrowest table column, in pixels, for dragging and the keyboard. */
export const TABLE_COLUMN_MIN_WIDTH = 48;

function columnWidth(table: ProseMirrorNode, map: TableMap, col: number, measure: (pos: number) => number): number {
  let measured = 0;
  for (let row = 0; row < map.height; row++) {
    const pos = map.map[row * map.width + col];
    if (pos === undefined) continue;
    const cell = table.nodeAt(pos);
    const widths = cell?.attrs.colwidth as number[] | null | undefined;
    const index = col - map.colCount(pos);
    const stored = widths?.[index];
    if (stored) return stored;
    if (!measured && cell) measured = measure(pos) / ((cell.attrs.colspan as number) || 1);
  }
  return measured > 0 ? Math.round(measured) : 100;
}

function setColumnWidthIn(tr: Transaction, table: ProseMirrorNode, map: TableMap, tableStart: number, col: number, width: number | null): void {
  for (let row = 0; row < map.height; row++) {
    const mapIndex = row * map.width + col;
    const pos = map.map[mapIndex];
    if (pos === undefined || (row > 0 && map.map[mapIndex - map.width] === pos)) continue;
    const cell = table.nodeAt(pos);
    if (!cell) continue;
    const colspan = (cell.attrs.colspan as number) || 1;
    const index = col - map.colCount(pos);
    const current = cell.attrs.colwidth as number[] | null;
    if ((current?.[index] ?? null) === width || (width === null && !current)) continue;
    const next = current ? current.slice() : Array.from({ length: colspan }, () => 0);
    next[index] = width ?? 0;
    tr.setNodeMarkup(tableStart + pos, undefined, { ...cell.attrs, colwidth: next.some(Boolean) ? next : null });
  }
}

/**
 * Widens (positive `delta`) or narrows the selected table columns by
 * `delta` pixels. `measure` returns a cell's rendered width for columns
 * that have no stored width yet.
 */
export function resizeTableColumn(delta: number, measure: (cellPos: number) => number): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    const rect = selectedRect(state);
    const tr = state.tr;
    for (let col = rect.left; col < rect.right; col++) {
      const width = Math.max(TABLE_COLUMN_MIN_WIDTH, Math.round(columnWidth(rect.table, rect.map, col, (pos) => measure(rect.tableStart + pos)) + delta));
      setColumnWidthIn(tr, rect.table, rect.map, rect.tableStart, col, width);
    }
    if (!tr.docChanged) return false;
    if (dispatch) dispatch(tr);
    return true;
  };
}

/** Clears stored column widths so the table's columns share its width evenly. */
export const evenTableColumns: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  const tr = state.tr;
  for (let col = 0; col < rect.map.width; col++) setColumnWidthIn(tr, rect.table, rect.map, rect.tableStart, col, null);
  if (!tr.docChanged) return false;
  if (dispatch) dispatch(tr);
  return true;
};

/** The width of the first selected column: its stored width, or what `measure` reports. */
export function currentColumnWidth(state: EditorState, measure: (cellPos: number) => number): number | null {
  if (!isInTable(state)) return null;
  const rect = selectedRect(state);
  return columnWidth(rect.table, rect.map, rect.left, (pos) => measure(rect.tableStart + pos));
}

/** Column resizing from prosemirror-tables, idle while `isActive` returns false (for example in compact editors). */
export function tableResizingPlugin(isActive: () => boolean): Plugin {
  const base = columnResizing({ handleWidth: 6, cellMinWidth: TABLE_COLUMN_MIN_WIDTH });
  const props = base.spec.props ?? {};
  const events = props.handleDOMEvents ?? {};
  const { mousemove, mouseleave, mousedown } = events;
  const { decorations, attributes } = props;
  return new Plugin({
    ...base.spec,
    props: {
      ...props,
      attributes: (state) => (isActive() && typeof attributes === "function" ? attributes.call(base, state) : {}),
      decorations: (state) => (isActive() && decorations ? decorations.call(base, state) : null),
      handleDOMEvents: {
        mousemove: (view, event) => (isActive() && mousemove ? mousemove.call(base, view, event) : false),
        mouseleave: (view, event) => (isActive() && mouseleave ? mouseleave.call(base, view, event) : false),
        mousedown: (view, event) => (isActive() && mousedown ? mousedown.call(base, view, event) : false),
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Embedding pasted and dropped images                                 */
/* ------------------------------------------------------------------ */

/** Largest image embedded as a data URL when no `onImageUpload` is given: 2 MB. */
export const MAX_EMBEDDED_IMAGE_BYTES = 2 * 1024 * 1024;

/** Image types embedded as data URLs. SVG is left out because it can carry scripts. */
export const EMBEDDABLE_IMAGE_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

/** Why a file can't be embedded as a data URL: its type, its size, or null when it can. */
export function embeddedImageProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!EMBEDDABLE_IMAGE_TYPES.includes(file.type.toLowerCase())) return "type";
  return file.size > MAX_EMBEDDED_IMAGE_BYTES ? "size" : null;
}

/** Reads a file as a data URL. */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unreadable file")));
    reader.onerror = () => reject(reader.error ?? new Error("Unreadable file"));
    reader.readAsDataURL(file);
  });
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)!}`;
}

/** The status line after embedding: what was added and why anything was refused. */
export function embedStatus({ added, tooLarge, wrongType, failed }: { added: string[]; tooLarge: string[]; wrongType: string[]; failed: string[] }): string {
  const parts: string[] = [];
  if (added.length) parts.push(added.length === 1 ? `Added ${added[0]!}.` : `Added ${added.length} images.`);
  if (tooLarge.length) parts.push(`${listNames(tooLarge)} ${tooLarge.length === 1 ? "is" : "are"} larger than 2 MB. Pass onImageUpload to HtmlEditor to add large images.`);
  if (wrongType.length) parts.push(`${listNames(wrongType)} ${wrongType.length === 1 ? "wasn't" : "weren't"} added: only PNG, JPEG, GIF, WebP and AVIF images can be embedded.`);
  if (failed.length) parts.push(`Couldn't read ${listNames(failed)}.`);
  return parts.join(" ");
}

function imageFiles(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter((file) => file.type.startsWith("image/"));
}

function insertFigureAt(state: EditorState, at: number, src: string, alt: string): Transaction | null {
  const { figure, paragraph } = state.schema.nodes;
  if (!figure || !paragraph) return null;
  const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(Math.max(0, Math.min(at, state.doc.content.size)))));
  tr.replaceSelectionWith(figure.create({ src, alt }));
  const after = tr.selection.$from;
  if (!after.nodeAfter || !after.nodeAfter.isTextblock) tr.insert(after.pos, paragraph.create());
  return tr.scrollIntoView();
}

/** Embeds image files as data URL figures at `at`, one after another, and reports the result through `setStatus`. */
export async function embedImageFiles(view: EditorView, files: File[], at: number, setStatus: (message: string) => void): Promise<void> {
  const report = { added: [] as string[], tooLarge: [] as string[], wrongType: [] as string[], failed: [] as string[] };
  let position = at;
  for (const file of files) {
    const problem = embeddedImageProblem(file);
    if (problem) {
      (problem === "size" ? report.tooLarge : report.wrongType).push(file.name);
      continue;
    }
    setStatus(`Adding ${file.name}…`);
    try {
      const src = await readFileAsDataUrl(file);
      if (!/^data:image\/(?:png|jpeg|gif|webp|avif);base64,/i.test(src) || view.isDestroyed) throw new Error("Unsupported data URL");
      const tr = insertFigureAt(view.state, position, src, file.name.replace(/\.[^.]+$/, ""));
      if (!tr) throw new Error("No figure node");
      view.dispatch(tr);
      position = tr.selection.from;
      report.added.push(file.name);
    } catch {
      report.failed.push(file.name);
    }
  }
  setStatus(embedStatus(report));
}

export interface ImageEmbedOptions {
  /** Whether to embed right now (not compact, not read-only, and no `onImageUpload`). */
  canEmbed: (view: EditorView) => boolean;
  setStatus: (message: string) => void;
}

/**
 * Embeds pasted and dropped image files as data URLs, at most
 * MAX_EMBEDDED_IMAGE_BYTES each and only EMBEDDABLE_IMAGE_TYPES, as figures
 * at the cursor or drop point. Other files are refused with a status
 * message, and pastes that also carry text paste the text. HtmlEditorView
 * handles files itself when `onImageUpload` is set.
 */
export function imageEmbedPlugin({ canEmbed, setStatus }: ImageEmbedOptions): Plugin {
  return new Plugin({
    props: {
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        // Word and spreadsheets put a picture of copied text next to the text itself; paste the text then.
        if (!files.length || !canEmbed(view) || event.clipboardData?.getData("text/plain").trim()) return false;
        event.preventDefault();
        void embedImageFiles(view, files, view.state.selection.from, setStatus);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length || !canEmbed(view)) return false;
        event.preventDefault();
        void embedImageFiles(view, files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from, setStatus);
        return true;
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Node views                                                          */
/* ------------------------------------------------------------------ */

/** What the media node views need from the editor around them. */
export interface MediaViewContext {
  /** True when editing UI should show: not compact, not read-only. */
  editing: (view: EditorView) => boolean;
  setStatus: (message: string) => void;
  /** Opens the tone menu for the callout at `pos`, anchored to its button. */
  openToneMenu: (pos: number, anchor: HTMLElement) => void;
  /** Live node views, refreshed when editing turns on or off. */
  views: Set<{ refresh: () => void }>;
}

type IconNode = ReadonlyArray<readonly [string, Readonly<Record<string, string>>]>;

/*
 * Icon paths from Lucide 1.61.0, for controls drawn without React. The info,
 * plus, minus and alert shapes derive from Feather. Both notices follow.
 *
 * ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * The MIT License (MIT) (for the icons derived from Feather)
 *
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const ICONS = {
  info: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 16v-4" }],
    ["path", { d: "M12 8h.01" }],
  ],
  note: [
    ["path", { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" }],
    ["path", { d: "M9 18h6" }],
    ["path", { d: "M10 22h4" }],
  ],
  success: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m16 9-5.5 5.5L8 12" }],
  ],
  warning: [
    ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  danger: [
    ["path", { d: "M12 16h.01" }],
    ["path", { d: "M12 8v4" }],
    ["path", { d: "M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z" }],
  ],
  plus: [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "M12 5v14" }],
  ],
  minus: [["path", { d: "M5 12h14" }]],
  ungroup: [
    ["rect", { x: "11", y: "14", width: "10", height: "7", rx: "2" }],
    ["rect", { x: "3", y: "3", width: "10", height: "7", rx: "2" }],
  ],
} satisfies Record<string, IconNode>;

const SVG_NS = "http://www.w3.org/2000/svg";

function svgIcon(nodes: IconNode, className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs: Record<string, string> = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: className };
  for (const [name, value] of Object.entries(attrs)) svg.setAttribute(name, value);
  for (const [tag, childAttrs] of nodes) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(childAttrs)) child.setAttribute(name, value);
    svg.append(child);
  }
  return svg;
}

const CONTROL_BUTTON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-40";

function isInside(container: Element, target: EventTarget | Node | null): boolean {
  return target instanceof Node && container.contains(target);
}

/**
 * Replaces the classes this view added last time with `next`, leaving
 * classes that decorations from other plugins put on the element alone.
 */
function classSwapper(element: HTMLElement): (next: string) => void {
  let current: string[] = [];
  return (next) => {
    const tokens = next.split(/\s+/).filter(Boolean);
    element.classList.remove(...current.filter((token) => !tokens.includes(token)));
    element.classList.add(...tokens);
    current = tokens;
  };
}

function availableWidth(element: HTMLElement): number {
  const parent = element.parentElement;
  if (!parent) return 0;
  const style = getComputedStyle(parent);
  return Math.max(0, parent.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0));
}

const FIGURE_ALIGN_CLASSES: Record<FigureAlign, string> = {
  left: "float-left mt-1 mr-6 mb-3 ml-0 max-w-[50%]",
  right: "float-right mt-1 mr-0 mb-3 ml-6 max-w-[50%]",
  center: "mx-auto my-4 max-w-full",
  wide: "mx-0 my-4 w-full",
};

/** The figure's image box, which the toolbar positions itself against. */
export const FIGURE_BOX_SELECTOR = "[data-figure-box]";

/**
 * Figure editing view: the image with resize handles on both edges, and an
 * editable caption with an "Add a caption" placeholder while it is empty
 * and in use. Alignment and width follow the node's attributes.
 */
export function figureView(initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined, ctx: MediaViewContext): NodeView {
  let node = initial;
  let selected = false;
  let captionActive = false;
  let dragging = false;

  const dom = document.createElement("figure");
  const frame = document.createElement("div");
  frame.contentEditable = "false";
  frame.className = "flex justify-center";
  const box = document.createElement("div");
  box.dataset.figureBox = "";
  box.className =
    "relative flex max-w-full min-w-0 rounded-md outline-offset-2 group-data-[selected=true]/figure:outline-2 group-data-[selected=true]/figure:outline-primary group-data-[resizing=true]/figure:outline-2 group-data-[resizing=true]/figure:outline-primary";
  const image = document.createElement("img");
  image.className = "block h-auto max-w-full rounded-md";
  const badge = document.createElement("span");
  badge.setAttribute("aria-hidden", "true");
  badge.hidden = true;
  badge.className = "pointer-events-none absolute right-2 bottom-2 rounded bg-foreground/80 px-1.5 py-0.5 text-xs font-medium text-background tabular-nums";
  const handles = (["left", "right"] as const).map((side) => {
    const handle = document.createElement("span");
    handle.dataset.figureHandle = side;
    handle.setAttribute("aria-hidden", "true");
    handle.className = `absolute top-1/2 z-10 hidden h-12 max-h-[70%] w-3 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center group-hover/figure:flex group-data-[selected=true]/figure:flex ${side === "left" ? "-left-1.5" : "-right-1.5"}`;
    const grip = document.createElement("span");
    grip.className = "h-full w-1.5 rounded-full border border-background bg-primary shadow-sm";
    handle.append(grip);
    handle.addEventListener("pointerdown", (event) => startResize(event, side, handle));
    return handle;
  });
  box.append(image, ...handles, badge);
  frame.append(box);
  const caption = document.createElement("figcaption");
  caption.className =
    "relative mt-2 text-center text-sm text-muted-foreground outline-none before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:text-muted-foreground before:content-[attr(data-placeholder)]";
  dom.append(frame, caption);
  const setClasses = classSwapper(dom);

  const layout = (align: FigureAlign, width: number | null) => {
    setClasses(`group/figure relative ${FIGURE_ALIGN_CLASSES[align] ?? FIGURE_ALIGN_CLASSES.center}`);
    dom.dataset.align = align;
    const sized = width !== null || align === "wide";
    dom.style.width = width !== null && align !== "wide" ? `${width}px` : "";
    box.classList.toggle("w-full", sized);
    image.classList.toggle("w-full", sized);
  };

  const render = () => {
    const { src, alt, title, width, align } = node.attrs as { src: string; alt: string; title: string | null; width: number | null; align: FigureAlign };
    const editing = ctx.editing(view);
    if (image.getAttribute("src") !== src) image.setAttribute("src", src);
    image.alt = alt;
    if (title) image.title = title;
    else image.removeAttribute("title");
    if (!dragging) layout(align, width);
    dom.dataset.selected = String(selected && editing);
    const empty = node.content.size === 0;
    for (const handle of handles) handle.hidden = !editing || align === "wide";
    caption.hidden = empty && !editing;
    if (editing && empty && (selected || captionActive)) caption.dataset.placeholder = "Add a caption";
    else delete caption.dataset.placeholder;
  };

  function startResize(event: PointerEvent, side: "left" | "right", handle: HTMLElement) {
    const pos = getPos();
    if (event.button !== 0 || pos === undefined || !ctx.editing(view)) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    const align = node.attrs.align as FigureAlign;
    const liveAlign: FigureAlign = align === "wide" ? "center" : align;
    const floated = align === "left" || align === "right";
    const available = availableWidth(dom);
    const max = available > 0 ? (floated ? available / 2 : available) : FIGURE_MAX_WIDTH;
    const factor = liveAlign === "center" ? 2 : 1;
    const startX = event.clientX;
    // offsetWidth is in CSS pixels; the bounding box also reflects zoom (page layout), which pointer movement is measured in.
    const startWidth = box.offsetWidth || (node.attrs.width as number | null) || FIGURE_MIN_WIDTH;
    const scale = box.offsetWidth ? box.getBoundingClientRect().width / box.offsetWidth || 1 : 1;
    let width = clampFigureWidth(startWidth, max);
    let moved = false;
    dragging = true;
    dom.dataset.resizing = "true";
    badge.hidden = false;
    badge.textContent = `${width} px`;
    const move = (moveEvent: PointerEvent) => {
      moved ||= moveEvent.clientX !== startX;
      width = clampFigureWidth(startWidth + ((moveEvent.clientX - startX) / scale) * (side === "right" ? 1 : -1) * factor, max);
      layout(liveAlign, width);
      badge.textContent = `${width} px`;
    };
    const finish = (commit: boolean) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      handle.releasePointerCapture?.(event.pointerId);
      dragging = false;
      delete dom.dataset.resizing;
      badge.hidden = true;
      const at = getPos();
      if (at !== undefined) {
        const resized = commit && moved && width !== node.attrs.width;
        const tr = resized ? view.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, width, align: liveAlign }) : view.state.tr;
        view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, at)));
        if (resized) ctx.setStatus(`Image width ${width} pixels`);
      }
      render();
      view.focus();
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
  }

  const nodeView = {
    refresh: render,
  };
  ctx.views.add(nodeView);
  render();

  return {
    dom,
    contentDOM: caption,
    update: (next, decorations) => {
      if (next.type !== node.type) return false;
      node = next;
      captionActive = decorations.some((decoration) => (decoration.spec as { captionActive?: boolean }).captionActive === true);
      render();
      return true;
    },
    selectNode: () => {
      selected = true;
      dom.classList.add("ProseMirror-selectednode");
      render();
    },
    deselectNode: () => {
      selected = false;
      dom.classList.remove("ProseMirror-selectednode");
      render();
    },
    stopEvent: (event) => handles.some((handle) => isInside(handle, event.target)),
    ignoreMutation: (mutation) => {
      if (mutation.type === "selection") return isInside(frame, mutation.target);
      if (mutation.type === "attributes") return mutation.target === dom || mutation.target === caption || isInside(frame, mutation.target);
      return isInside(frame, mutation.target);
    },
    destroy: () => {
      ctx.views.delete(nodeView);
    },
  };
}

const CALLOUT_TONE_CLASSES: Record<CalloutTone, { surface: string; icon: string }> = {
  info: { surface: "border-chart-1 bg-chart-1/10", icon: "text-chart-1" },
  note: { surface: "border-muted-foreground bg-muted", icon: "text-muted-foreground" },
  success: { surface: "border-success bg-success/10", icon: "text-success" },
  warning: { surface: "border-warning bg-warning/10", icon: "text-warning" },
  danger: { surface: "border-destructive bg-destructive/10", icon: "text-destructive" },
};

/** Marks the element that holds a block's controls, for Alt+F10. */
const CONTROLS_ATTR = "data-media-controls";

/**
 * Callout editing view: a colored panel with the tone's icon. While
 * editing, the icon is a button named "Callout type: …" that opens the
 * tone menu.
 */
export function calloutView(initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined, ctx: MediaViewContext): NodeView {
  let node = initial;
  const dom = document.createElement("aside");
  const gutter = document.createElement("div");
  gutter.contentEditable = "false";
  gutter.setAttribute(CONTROLS_ATTR, "");
  gutter.className = "flex shrink-0 pt-0.5";
  const content = document.createElement("div");
  content.className = "min-w-0 flex-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0";
  dom.append(gutter, content);
  const setClasses = classSwapper(dom);
  let mode: "edit" | "view" | null = null;

  const render = () => {
    const tone = (CALLOUT_TONES.includes(node.attrs.tone as CalloutTone) ? node.attrs.tone : "info") as CalloutTone;
    const classes = CALLOUT_TONE_CLASSES[tone];
    const label = CALLOUT_TONE_LABELS[tone];
    dom.dataset.callout = tone;
    setClasses(`my-3 flex gap-2 rounded-md border-l-4 py-2 pr-4 pl-2 text-foreground ${classes.surface}`);
    const next = ctx.editing(view) ? "edit" : "view";
    if (next !== mode) {
      mode = next;
      gutter.replaceChildren();
      if (next === "edit") {
        const button = document.createElement("button");
        button.type = "button";
        button.tabIndex = -1;
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-keyshortcuts", "Alt+F10");
        button.className = CONTROL_BUTTON;
        button.addEventListener("click", () => {
          const pos = getPos();
          if (pos === undefined) return;
          const { from, to } = view.state.selection;
          if (from <= pos || to >= pos + node.nodeSize) view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(pos + 1))));
          ctx.openToneMenu(pos, button);
        });
        button.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            button.click();
          } else if (event.key === "Escape") {
            event.preventDefault();
            view.focus();
          }
        });
        gutter.append(button);
      } else {
        const badge = document.createElement("span");
        badge.setAttribute("role", "img");
        badge.className = "inline-flex size-7 items-center justify-center";
        gutter.append(badge);
      }
    }
    const control = gutter.firstElementChild as HTMLElement;
    control.replaceChildren(svgIcon(ICONS[tone], `size-4 ${classes.icon}`));
    if (mode === "edit") {
      control.setAttribute("aria-label", `Callout type: ${label}`);
      control.title = `Callout type: ${label}`;
    } else {
      control.setAttribute("aria-label", label);
    }
  };

  const nodeView = { refresh: render };
  ctx.views.add(nodeView);
  render();

  return {
    dom,
    contentDOM: content,
    update: (next) => {
      if (next.type !== node.type) return false;
      node = next;
      render();
      return true;
    },
    stopEvent: (event) => isInside(gutter, event.target),
    ignoreMutation: (mutation) => {
      if (mutation.type === "selection") return isInside(gutter, mutation.target);
      if (mutation.type === "attributes") return mutation.target === dom || isInside(gutter, mutation.target);
      return isInside(gutter, mutation.target);
    },
    destroy: () => {
      ctx.views.delete(nodeView);
    },
  };
}

const COLUMN_GRID_CLASSES =
  "grid gap-6 [&>[data-column]]:min-w-0 [&>[data-column]]:rounded-sm [&>[data-column]]:outline-1 [&>[data-column]]:outline-offset-4 [&>[data-column]]:outline-transparent [&>[data-column]]:outline-dashed group-hover/columns:[&>[data-column]]:outline-border group-data-[active=true]/columns:[&>[data-column]]:outline-border [&>[data-column]>:first-child]:mt-0 [&>[data-column]>:last-child]:mb-0";

/**
 * Column layout editing view. A grid that stacks into one column when the
 * layout is narrower than 28rem (32rem for three columns), with a small
 * toolbar on hover or while the cursor is inside: add a column, remove the
 * column with the cursor (or the last one), and remove the layout.
 */
export function columnsView(initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined, ctx: MediaViewContext): NodeView {
  let node = initial;
  const dom = document.createElement("div");
  dom.className = "group/columns @container relative my-4";
  const grid = document.createElement("div");
  dom.append(grid);
  let controls: HTMLElement | null = null;
  let buttons: { add: HTMLButtonElement; remove: HTMLButtonElement; unwrap: HTMLButtonElement } | null = null;

  const act = (button: HTMLButtonElement, action: (pos: number) => void) => {
    if (button.getAttribute("aria-disabled") === "true") return;
    const pos = getPos();
    if (pos !== undefined) action(pos);
  };

  const makeButton = (label: string, icon: IconNode, action: (pos: number) => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.className = `${CONTROL_BUTTON} text-muted-foreground`;
    button.append(svgIcon(icon, "size-4"));
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => act(button, action));
    return button;
  };

  const buildControls = () => {
    const bar = document.createElement("div");
    bar.contentEditable = "false";
    bar.setAttribute(CONTROLS_ATTR, "");
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Column layout");
    bar.className =
      "absolute top-0 right-2 z-10 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 text-popover-foreground shadow-sm group-hover/columns:flex group-data-[active=true]/columns:flex focus-within:flex";
    const add = makeButton("Add column", ICONS.plus, (pos) => {
      if (addColumn(pos, columnIndexAt(view.state, pos) ?? undefined)(view.state, view.dispatch)) ctx.setStatus(`Added a column. ${node.childCount} columns.`);
    });
    add.setAttribute("aria-keyshortcuts", "Alt+F10");
    const remove = makeButton("Remove column", ICONS.minus, (pos) => {
      const index = columnIndexAt(view.state, pos) ?? node.childCount - 1;
      if (removeColumn(pos, index)(view.state, view.dispatch)) ctx.setStatus(`Removed column ${index + 1}. ${node.childCount} columns.`);
    });
    const unwrap = makeButton("Remove layout", ICONS.ungroup, (pos) => {
      if (!unwrapColumns(pos)(view.state, view.dispatch)) return;
      ctx.setStatus("Removed the column layout");
      view.focus();
    });
    bar.addEventListener("keydown", (event) => {
      const items = [add, remove, unwrap];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") {
        event.preventDefault();
        view.focus();
      } else if (index >= 0 && (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End")) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
        items[next]!.focus();
      }
    });
    bar.append(add, remove, unwrap);
    buttons = { add, remove, unwrap };
    return bar;
  };

  const render = () => {
    const count = node.childCount;
    dom.dataset.columns = String(count);
    grid.className = `${COLUMN_GRID_CLASSES} ${count === 3 ? "grid-cols-3 @max-lg:grid-cols-1" : "grid-cols-2 @max-md:grid-cols-1"}`;
    const editing = ctx.editing(view);
    dom.classList.toggle("pt-4", editing);
    if (editing) {
      if (!controls) {
        controls = buildControls();
        dom.prepend(controls);
      }
      buttons?.add.setAttribute("aria-disabled", String(count >= MAX_COLUMNS));
      buttons?.remove.setAttribute("aria-disabled", String(count <= 2));
    } else if (controls) {
      controls.remove();
      controls = null;
      buttons = null;
    }
  };

  const nodeView = { refresh: render };
  ctx.views.add(nodeView);
  render();

  return {
    dom,
    contentDOM: grid,
    update: (next) => {
      if (next.type !== node.type) return false;
      node = next;
      render();
      return true;
    },
    stopEvent: (event) => (controls ? isInside(controls, event.target) : false),
    ignoreMutation: (mutation) => {
      const inControls = controls !== null && isInside(controls, mutation.target);
      if (mutation.type === "selection") return inControls;
      if (mutation.type === "attributes") return mutation.target === dom || mutation.target === grid || inControls;
      if (mutation.type === "childList" && mutation.target === dom) return true;
      return inControls;
    },
    destroy: () => {
      ctx.views.delete(nodeView);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Keyboard and decorations                                            */
/* ------------------------------------------------------------------ */

interface MediaUiState {
  editing: boolean;
}

export const mediaUiKey = new PluginKey<MediaUiState>("ai-ui-html-media");

export interface MediaUiOptions {
  /** True when editing UI should show: not compact, not read-only. */
  isEditing: () => boolean;
  setStatus: (message: string) => void;
  /** Moves focus to the figure toolbar; false when it isn't showing. */
  focusFigureToolbar: () => boolean;
  views: Set<{ refresh: () => void }>;
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function resizeSelectedFigure(view: EditorView, direction: 1 | -1, setStatus: (message: string) => void): boolean {
  const figure = selectedFigure(view.state);
  if (!figure) return false;
  const dom = view.nodeDOM(figure.pos);
  const element = dom instanceof HTMLElement ? dom : null;
  const available = element ? availableWidth(element) : 0;
  const rendered = element?.querySelector<HTMLElement>(FIGURE_BOX_SELECTOR)?.offsetWidth ?? 0;
  const align = figure.node.attrs.align as FigureAlign;
  const current = align === "wide" && available > 0 ? available : ((figure.node.attrs.width as number | null) ?? (rendered || (available ? available / 2 : 400)));
  const width = steppedFigureWidth(current, available, direction, align === "left" || align === "right");
  const changed = updateFigure(figure.pos, { width, ...(align === "wide" ? { align: "center" as const } : {}) })(view.state, view.dispatch);
  setStatus(changed ? `Image width ${width} pixels${available > 0 ? `, ${Math.round((width / available) * 100)}% of the text width` : ""}` : `Image width ${width} pixels, the ${direction > 0 ? "largest" : "smallest"} size`);
  return true;
}

function focusBlockControls(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if (name !== "callout" && name !== "columns") continue;
    const dom = view.nodeDOM($from.before(depth));
    const control = dom instanceof HTMLElement ? dom.querySelector<HTMLElement>(`:scope > [${CONTROLS_ATTR}] button:not([aria-disabled="true"])`) : null;
    if (control) {
      control.focus();
      return true;
    }
  }
  return false;
}

/**
 * Whether a transaction would change a figure into another kind of block.
 * A figure is a textblock (its caption), so block-type commands such as
 * "Heading 1" would otherwise turn it into a heading and drop the image.
 */
export function retypesFigure(tr: Transaction): boolean {
  return tr.steps.some((step, index) => {
    if (!(step instanceof ReplaceAroundStep) || step.gapFrom !== step.from + 1 || step.gapTo !== step.to - 1) return false;
    const replacement = step.slice.content.firstChild;
    return tr.docs[index]?.nodeAt(step.from)?.type.name === "figure" && replacement !== null && replacement.type.name !== "figure";
  });
}

const BLOCK_SHORTCUT = /^(?:#{1,6}|```[\w+#-]*|>)\s$/;

function exitCaption(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, figure: FoundNode): boolean {
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return false;
  if (dispatch) {
    const after = figure.pos + figure.node.nodeSize;
    const next = state.doc.nodeAt(after);
    const tr = state.tr;
    if (!(next && next.type === paragraph && next.content.size === 0)) tr.insert(after, paragraph.create());
    dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
  }
  return true;
}

/**
 * Pointer, keyboard and decoration support for figures, callouts and
 * columns: clicking an image selects its figure, Alt+Left and Alt+Right
 * resize the selected figure by a tenth of the text width, Tab moves from
 * a selected figure to its toolbar, Alt+F10 focuses the controls of the
 * figure, callout or column layout at the cursor, Escape in a caption (and
 * Up or Left from its start) selects the figure, and Enter in a caption
 * continues below the figure. Does nothing while editing UI is off, except
 * that it always refuses to turn a figure into another block (markdown
 * shortcuts typed in a caption stay text), so block-type commands can't
 * drop an image.
 */
export function mediaUiPlugin(options: MediaUiOptions): Plugin<MediaUiState> {
  return new Plugin<MediaUiState>({
    key: mediaUiKey,
    state: {
      init: () => ({ editing: options.isEditing() }),
      apply: (tr, previous) => {
        if (!tr.getMeta(HTML_EDITOR_PROPS_META)) return previous;
        const editing = options.isEditing();
        return editing === previous.editing ? previous : { editing };
      },
    },
    view: () => ({
      update: (view, previous) => {
        if (mediaUiKey.getState(view.state)?.editing !== mediaUiKey.getState(previous)?.editing) for (const nodeView of options.views) nodeView.refresh();
      },
    }),
    filterTransaction: (tr) => !tr.docChanged || !retypesFigure(tr),
    props: {
      handleTextInput: (view, from, to, text) => {
        if (!captionFigure(view.state)) return false;
        const $from = view.state.doc.resolve(from);
        if (!BLOCK_SHORTCUT.test($from.parent.textBetween(0, $from.parentOffset, undefined, "￼") + text)) return false;
        view.dispatch(view.state.tr.insertText(text, from, to));
        return true;
      },
      decorations: (state) => {
        if (!mediaUiKey.getState(state)?.editing) return null;
        const decorations: Decoration[] = [];
        const figure = captionFigure(state);
        if (figure) decorations.push(Decoration.node(figure.pos, figure.pos + figure.node.nodeSize, {}, { captionActive: true }));
        const layout = columnsAround(state);
        if (layout) decorations.push(Decoration.node(layout.pos, layout.pos + layout.node.nodeSize, { "data-active": "true" }));
        return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
      },
      handleClickOn: (view, _pos, node, nodePos, event, direct) => {
        if (!direct || node.type.name !== "figure" || !mediaUiKey.getState(view.state)?.editing || !(event.target instanceof Element) || !event.target.closest(FIGURE_BOX_SELECTOR)) return false;
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
        return true;
      },
      handleKeyDown: (view, event) => {
        if (!mediaUiKey.getState(view.state)?.editing || !view.editable || event.isComposing) return false;
        const figure = selectedFigure(view.state);
        if (figure && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          return resizeSelectedFigure(view, event.key === "ArrowRight" ? 1 : -1, options.setStatus);
        }
        if (event.key === "F10" && event.altKey && !event.ctrlKey && !event.metaKey) return figure ? options.focusFigureToolbar() : focusBlockControls(view);
        if (hasModifier(event)) return false;
        if (figure && event.key === "Tab") return options.focusFigureToolbar();
        const caption = captionFigure(view.state);
        if (!caption) return false;
        const { selection } = view.state;
        const leaving = selection.empty && ((event.key === "ArrowLeft" && selection.$from.parentOffset === 0) || (event.key === "ArrowUp" && view.endOfTextblock("up")));
        if (event.key === "Escape" || leaving) {
          view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, caption.pos)).scrollIntoView());
          return true;
        }
        return event.key === "Enter" ? exitCaption(view.state, view.dispatch, caption) : false;
      },
    },
  });
}
