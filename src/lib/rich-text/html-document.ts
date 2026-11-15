// packages/ai-ui/src/lib/rich-text/html-document.ts
import { closeHistory, undo, undoDepth } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { type Command, type EditorState, NodeSelection, Plugin, PluginKey, TextSelection, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView, type NodeView, type NodeViewConstructor } from "prosemirror-view";

import { HTML_EDITOR_PROPS_META } from "../../components/html-editor-extension.js";
import { MAX_FOOTNOTE_LENGTH, tocHeadings } from "./html.js";

/*
 * Word-style documents for HtmlEditor: page layout with headers, footers
 * and page numbers, page breaks, a live table of contents and footnotes.
 * Pure pagination and template logic sits at the top so it can be tested
 * without a layout engine; the plugin and node views follow.
 */

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export type PageSizeName = "letter" | "a4";

/** CSS pixels per inch, as browsers lay out print. */
export const PX_PER_INCH = 96;

/** Paper size and margins in CSS pixels. */
export interface PageMetrics {
  label: string;
  width: number;
  height: number;
  /** Margin on every side: one inch. */
  margin: number;
  contentWidth: number;
  contentHeight: number;
  /** The CSS `@page` size value. */
  css: string;
}

function metrics(label: string, widthIn: number, heightIn: number, css: string): PageMetrics {
  const width = widthIn * PX_PER_INCH;
  const height = heightIn * PX_PER_INCH;
  return { label, width, height, margin: PX_PER_INCH, contentWidth: width - 2 * PX_PER_INCH, contentHeight: height - 2 * PX_PER_INCH, css };
}

/** Letter (8.5 x 11 in) and A4 (210 x 297 mm) at 96 px per inch with one inch margins. */
export const PAGE_SIZES: Record<PageSizeName, PageMetrics> = {
  letter: metrics("Letter", 8.5, 11, "8.5in 11in"),
  a4: metrics("A4", 210 / 25.4, 297 / 25.4, "210mm 297mm"),
};

/** Gray space between pages on screen, in CSS pixels. */
export const PAGE_GAP = 24;

/** The footer HtmlEditor uses when none is given. */
export const DEFAULT_PAGE_FOOTER = "Page {page} of {pages}";

/** Values for the tokens in header and footer templates. */
export interface PageTemplateValues {
  page: number;
  pages: number;
  title: string;
  date: string;
}

const TOKEN = /\{(page|pages|title|date)\}/g;

/** Fills {page}, {pages}, {title} and {date} in a header or footer template; other text stays as written. */
export function fillPageTemplate(template: string, values: PageTemplateValues): string {
  return template.replace(TOKEN, (_match, name: keyof PageTemplateValues) => String(values[name]));
}

/** Today's date as the reader writes it, e.g. "October 25, 2026" in US English. */
export function formatPageDate(date: Date = new Date(), locale?: string): string {
  if (locale !== undefined) return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
  readerDateFormat ??= new Intl.DateTimeFormat(undefined, { dateStyle: "long" });
  return readerDateFormat.format(date);
}

let readerDateFormat: Intl.DateTimeFormat | undefined;

/** A CSS string literal: quotes, backslashes, control characters and "<" escaped, so it cannot end the string, the rule or a style element. */
export function cssString(value: string): string {
  // eslint-disable-next-line no-control-regex
  const escaped = value.replace(/[\\"<>\u0000-\u001f\u007f]/g, (char) => (char === "\\" || char === '"' ? `\\${char}` : `\\${char.charCodeAt(0).toString(16)} `));
  return `"${escaped}"`;
}

/**
 * A header or footer template as a CSS `content` value: text becomes
 * escaped strings, {page} and {pages} become page counters, and {title}
 * and {date} are filled in. Empty templates give "".
 */
export function templateCssContent(template: string, values: Pick<PageTemplateValues, "title" | "date">): string {
  const parts: string[] = [];
  let text = "";
  let last = 0;
  const flush = () => {
    if (text) parts.push(cssString(text));
    text = "";
  };
  for (const match of template.matchAll(TOKEN)) {
    text += template.slice(last, match.index);
    last = match.index + match[0].length;
    const name = match[1] as keyof PageTemplateValues;
    if (name === "page" || name === "pages") {
      flush();
      parts.push(`counter(${name})`);
    } else text += values[name];
  }
  text += template.slice(last);
  flush();
  return parts.join(" ");
}

export interface PagePrintOptions {
  pageSize: PageSizeName;
  header: string;
  footer: string;
  title: string;
  /** Filled into {date}; defaults to today in the reader's locale. */
  date?: string;
}

/**
 * Print CSS for page layout: an `@page` rule with the paper size and one
 * inch margins, the header and footer in the top and bottom center margin
 * boxes, and a print reset so the content fills the page's text area.
 */
export function pagePrintStyles({ pageSize, header, footer, title, date = formatPageDate() }: PagePrintOptions): string {
  const page = PAGE_SIZES[pageSize] ?? PAGE_SIZES.letter;
  const box = (name: string, template: string) => {
    const content = templateCssContent(template, { title, date });
    return content ? `@${name}{content:${content};font:10pt/1.2 system-ui,sans-serif;color:#52525b}` : "";
  };
  return `@page{size:${page.css};margin:1in;${box("top-center", header)}${box("bottom-center", footer)}}@media print{body{max-width:none;margin:0;padding:0}}`;
}

/** One top-level block as pagination sees it, in CSS pixels. */
export interface PageBlock {
  /** Border-box height. */
  height: number;
  marginTop: number;
  marginBottom: number;
  /** Distance from the previous block's bottom border edge to this block's top border edge in unbroken flow. Ignored for the first block. */
  spacingBefore: number;
  /** Starts a new page whatever space is left, as the block after a page break does. */
  breakBefore?: boolean;
  /** May hang into the bottom margin instead of moving to the next page, as a page break marker does. */
  hang?: boolean;
}

/** Where pages break: before `blocks[index]`, leaving `fill` pixels blank at the bottom of the page before it. */
export interface PageFlow {
  breaks: Array<{ index: number; fill: number }>;
  /** Blank space at the bottom of the last page. */
  lastFill: number;
}

const OVERFLOW_TOLERANCE = 0.5;

/** Collapses two adjoining vertical margins the way CSS does. */
export function collapseMargins(a: number, b: number): number {
  return Math.max(a, b, 0) + Math.min(a, b, 0);
}

/**
 * Splits blocks into pages of `contentHeight`. A block that would end
 * below the page moves to the next page, and the first block on a page
 * keeps its top margin. A block taller than a page is not split: it sits
 * alone and the page grows to hold it.
 */
export function paginate(blocks: readonly PageBlock[], contentHeight: number): PageFlow {
  const breaks: PageFlow["breaks"] = [];
  let first = true;
  let bottom = 0;
  let lowest = 0;
  let lastMargin = 0;
  blocks.forEach((block, index) => {
    let top = first ? block.marginTop : bottom + block.spacingBefore;
    const overflows = !block.hang && top + block.height > contentHeight + OVERFLOW_TOLERANCE;
    if (!first && (block.breakBefore || overflows)) {
      breaks.push({ index, fill: contentHeight - (lowest + lastMargin) });
      top = block.marginTop;
      lowest = 0;
    }
    bottom = top + block.height;
    lowest = Math.max(lowest, bottom);
    lastMargin = block.marginBottom;
    first = false;
  });
  return { breaks, lastFill: blocks.length ? contentHeight - (lowest + lastMargin) : contentHeight };
}

/** The 1-based page holding `pos`, given the positions where pages 2, 3 and so on begin. */
export function pageAt(breakPositions: readonly number[], pos: number): number {
  let page = 1;
  for (const start of breakPositions) if (start <= pos) page++;
  return page;
}

/* ------------------------------------------------------------------ */
/* Footnotes                                                           */
/* ------------------------------------------------------------------ */

export interface FootnoteEntry {
  pos: number;
  text: string;
}

/** Footnotes in document order; a footnote's number is its index plus one. */
export function footnoteList(doc: ProseMirrorNode): FootnoteEntry[] {
  const entries: FootnoteEntry[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "footnote") entries.push({ pos, text: node.attrs.text as string });
    return !node.isLeaf;
  });
  return entries;
}

/** Footnote text as stored: control characters other than tabs and newlines removed, trimmed, at most MAX_FOOTNOTE_LENGTH. */
export function cleanFootnoteText(text: string): string {
  return text
    .replace(/(?![\t\n])\p{Cc}/gu, "")
    .trim()
    .slice(0, MAX_FOOTNOTE_LENGTH);
}

/* ------------------------------------------------------------------ */
/* Plugin state                                                        */
/* ------------------------------------------------------------------ */

/** What the document features read from the editor's props. */
export interface DocumentSettings {
  /** False in compact editors: everything is off. */
  enabled: boolean;
  readOnly: boolean;
  layout: "web" | "page";
  pageSize: PageSizeName;
  header: string;
  footer: string;
  title: string;
}

export interface PageBreakAt {
  /** Document position of the block that starts the page (the document's end for the footnotes list). */
  pos: number;
  /** Blank space left at the bottom of the page before it. */
  fill: number;
}

export interface FootnoteEditing {
  pos: number;
  /** Inserted just now and never saved: closing it empty undoes the insertion. */
  fresh: boolean;
  /** Where the editor was opened from, for anchoring its popover. */
  source: "reference" | "list";
  /** Increases with every opening, so a reopened editor starts over. */
  serial: number;
}

export interface DocumentState {
  /** Page layout is showing. */
  paged: boolean;
  size: PageSizeName;
  breaks: PageBreakAt[];
  lastFill: number;
  editing: FootnoteEditing | null;
  footnotes: FootnoteEntry[];
  decorations: DecorationSet;
}

interface DocumentMeta {
  pages?: { breaks: PageBreakAt[]; lastFill: number };
  edit?: Omit<FootnoteEditing, "serial"> | null;
}

/** Plugin key for the document features' state (pages, footnotes and the footnote being edited). */
export const documentKey = new PluginKey<DocumentState>("ai-ui-html-document");

/** Raised on the editor root when someone double-clicks a page header or footer. */
export const EDIT_HEADER_FOOTER_EVENT = "ai-ui-html-document:edit-header-footer";

/** Horizontal room kept beside the paper on the desk, per side. */
const DESK_GUTTER = 16;
/** Vertical room above the first and below the last page. */
const DESK_MARGIN = 24;
/** How far the gray strip between pages reaches past the paper, to cover its shadow. */
const BLEED = 8;
const MIN_SCALE = 0.25;
/** Consecutive pagination updates allowed before measuring settles without converging. */
const MAX_STREAK = 4;

const PAPER_CLASS = "bg-background shadow-sm ring-1 ring-border";
const PAGE_TEXT_CLASS = "absolute inset-x-0 flex items-center justify-center overflow-hidden text-xs leading-none whitespace-nowrap text-muted-foreground";

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

/**
 * Inserts a top-level block at the cursor: before an empty or untouched
 * paragraph, after it when the cursor is at its end, and between the two
 * halves otherwise. A nested cursor (in a list, table or callout) inserts
 * after the enclosing top-level block. The cursor lands in the text after.
 */
function insertTopLevel(state: EditorState, node: ProseMirrorNode): Transaction {
  const tr = state.tr;
  if (state.selection instanceof NodeSelection && state.selection.$from.depth === 0) {
    const after = state.selection.to;
    tr.insert(after, node);
    return finishTopLevel(tr, after + node.nodeSize);
  }
  if (!state.selection.empty) tr.deleteSelection();
  const $pos = tr.selection.$from;
  let at: number;
  if ($pos.depth === 0) at = $pos.pos;
  else if ($pos.depth > 1 || !$pos.parent.isTextblock) at = $pos.after(1);
  else if ($pos.parentOffset === 0) at = $pos.before();
  else if ($pos.parentOffset === $pos.parent.content.size) at = $pos.after();
  else {
    tr.split($pos.pos);
    at = $pos.pos + 1;
  }
  tr.insert(at, node);
  return finishTopLevel(tr, at + node.nodeSize);
}

/** Makes sure a textblock follows `after` and puts the cursor at its start. */
function finishTopLevel(tr: Transaction, after: number): Transaction {
  const next = tr.doc.nodeAt(after);
  if (!next || !next.isTextblock) tr.insert(after, tr.doc.type.schema.nodes.paragraph!.create());
  return tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
}

/** Inserts a page break at the cursor, splitting the paragraph; in page layout the text after it starts a new page. */
export const insertPageBreak: Command = (state, dispatch) => {
  const type = state.schema.nodes.page_break;
  if (!type || state.selection.$from.parent.type.spec.code) return false;
  if (dispatch) dispatch(insertTopLevel(state, type.create()));
  return true;
};

/** Inserts a table of contents that lists the document's headings. */
export const insertTableOfContents: Command = (state, dispatch) => {
  const type = state.schema.nodes.toc;
  if (!type) return false;
  if (dispatch) dispatch(insertTopLevel(state, type.create()));
  return true;
};

/** Inserts an empty footnote after the selection and opens its editor. */
export const insertFootnote: Command = (state, dispatch) => {
  const type = state.schema.nodes.footnote;
  if (!type) return false;
  const pos = state.selection.to;
  const $pos = state.doc.resolve(pos);
  if (!$pos.parent.inlineContent || !$pos.parent.canReplaceWith($pos.index(), $pos.index(), type)) return false;
  if (dispatch) {
    const tr = closeHistory(state.tr.insert(pos, type.create({ text: "" })));
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    tr.setMeta(documentKey, { edit: { pos, fresh: true, source: "reference" } } satisfies DocumentMeta);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Opens the editor for the footnote at `pos`. */
export function openFootnote(view: EditorView, pos: number, source: FootnoteEditing["source"] = "reference"): boolean {
  if (view.state.doc.nodeAt(pos)?.type.name !== "footnote") return false;
  view.dispatch(view.state.tr.setMeta(documentKey, { edit: { pos, fresh: false, source } } satisfies DocumentMeta));
  return true;
}

export interface FootnoteCloseOptions {
  /** "save" stores `text`; "cancel" keeps what was there; "delete" removes the footnote. */
  action: "save" | "cancel" | "delete";
  text?: string;
  /** Returns the cursor to just after the footnote and focuses the editor. */
  refocus: boolean;
  /** Undo depth right after a fresh footnote was inserted, so closing it empty can undo the insertion cleanly. */
  undoDepth?: number;
}

/**
 * Closes the footnote editor. Footnotes left empty are removed: a fresh
 * one by undoing its insertion (so history has no trace of it), an older
 * one as an undoable deletion. Saving a fresh footnote joins the insertion's
 * undo step. Returns what happened.
 */
export function closeFootnote(view: EditorView, { action, text = "", refocus, undoDepth: depth }: FootnoteCloseOptions): "saved" | "removed" | "unchanged" | null {
  const editing = documentKey.getState(view.state)?.editing;
  if (!editing) return null;
  const { pos, fresh } = editing;
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "footnote") {
    view.dispatch(view.state.tr.setMeta(documentKey, { edit: null } satisfies DocumentMeta));
    return null;
  }
  const value = action === "save" ? cleanFootnoteText(text) : (node.attrs.text as string);
  const finish = (tr: Transaction, cursor: number) => {
    tr.setMeta(documentKey, { edit: null } satisfies DocumentMeta);
    if (refocus) tr.setSelection(TextSelection.create(tr.doc, Math.min(cursor, tr.doc.content.size)));
    view.dispatch(tr);
    if (refocus) view.focus();
  };
  if (action === "delete" || !value) {
    if (fresh && depth !== undefined && undoDepth(view.state) === depth && undo(view.state, view.dispatch)) {
      if (documentKey.getState(view.state)?.editing) view.dispatch(view.state.tr.setMeta(documentKey, { edit: null } satisfies DocumentMeta));
      if (refocus) view.focus();
    } else {
      const tr = view.state.tr.delete(pos, pos + node.nodeSize);
      if (fresh) tr.setMeta("addToHistory", false);
      finish(tr, pos);
    }
    return "removed";
  }
  const tr = view.state.tr;
  if (action === "save" && value !== node.attrs.text) {
    tr.setNodeAttribute(pos, "text", value);
    if (fresh) tr.setMeta("addToHistory", false);
  }
  finish(tr, pos + node.nodeSize);
  return action === "save" ? "saved" : "unchanged";
}

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

/** A header or footer band: `height` tall, text centered in its top or bottom `margin` pixels. */
function pageBand(view: EditorView, settings: DocumentSettings, page: PageMetrics, height: number, text: string, edge: "top" | "bottom"): HTMLElement {
  const band = element("div", "relative");
  band.style.height = px(height);
  const label = element("div", PAGE_TEXT_CLASS);
  label.style.cssText = `${edge}:0;height:${px(Math.min(page.margin, height))};padding:0 ${page.margin}px`;
  const span = element("span", "block truncate");
  span.textContent = text;
  label.append(span);
  band.append(label);
  if (!settings.readOnly) {
    band.title = "Double-click to edit the header and footer";
    band.addEventListener("dblclick", (event) => {
      event.preventDefault();
      view.dom.dispatchEvent(new CustomEvent(EDIT_HEADER_FOOTER_EVENT, { bubbles: true }));
    });
  }
  return band;
}

function chrome(kind: string): HTMLElement {
  const node = element("div", "select-none");
  node.contentEditable = "false";
  node.setAttribute("aria-hidden", "true");
  node.dataset[kind] = "";
  return node;
}

function footerHeight(page: PageMetrics, fill: number): number {
  return Math.max(fill + page.margin, page.margin / 2);
}

/** The top margin of page 1 with its header. */
function pageHeadDom(view: EditorView, settings: DocumentSettings, page: PageMetrics, header: string): HTMLElement {
  const node = chrome("pageHead");
  node.style.margin = `0 -${page.margin}px`;
  node.append(pageBand(view, settings, page, page.margin, header, "top"));
  return node;
}

/** The end of one page (blank space and footer), the desk between pages, and the start of the next (header). */
function pageGapDom(view: EditorView, settings: DocumentSettings, page: PageMetrics, fill: number, footer: string, header: string): HTMLElement {
  const node = chrome("pageGap");
  node.style.cssText = `margin:0 -${page.margin + BLEED}px;clear:both`;
  const end = pageBand(view, settings, page, footerHeight(page, fill), footer, "bottom");
  const start = pageBand(view, settings, page, page.margin, header, "top");
  end.style.margin = start.style.margin = `0 ${BLEED}px`;
  const desk = element("div", "border-y border-border bg-muted");
  desk.style.height = `${PAGE_GAP}px`;
  node.append(end, desk, start);
  return node;
}

/** The blank space and footer of the last page. */
function pageTailDom(view: EditorView, settings: DocumentSettings, page: PageMetrics, fill: number, footer: string): HTMLElement {
  const node = chrome("pageTail");
  node.style.cssText = `margin:0 -${page.margin}px;clear:both`;
  node.append(pageBand(view, settings, page, footerHeight(page, fill), footer, "bottom"));
  return node;
}

/* ------------------------------------------------------------------ */
/* Roving focus for lists inside the document                          */
/* ------------------------------------------------------------------ */

/** Arrow keys, Home and End move focus between the container's `button[data-roving]` items (one tab stop); Escape calls `escape`. */
function rovingKeys(container: HTMLElement, escape: () => void): void {
  container.addEventListener("keydown", (event) => {
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button[data-roving]")];
    const index = buttons.findIndex((button) => button === event.target);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = Math.min(buttons.length - 1, index + 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      escape();
      return;
    } else return;
    event.preventDefault();
    for (const [position, button] of buttons.entries()) button.tabIndex = position === next ? 0 : -1;
    buttons[next]?.focus();
  });
}

const LIST_BUTTON_CLASS =
  "flex w-full min-w-0 items-baseline gap-2 rounded-md px-1.5 py-0.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The footnotes list at the end of the document. */
function footnotesDom(view: EditorView, settings: DocumentSettings, footnotes: readonly FootnoteEntry[]): HTMLElement {
  const id = uniqueId("footnotes");
  const node = element("div", "mt-8 border-t border-border pt-3 text-sm select-none");
  node.contentEditable = "false";
  node.dataset.footnotesList = "";
  node.setAttribute("role", "group");
  node.setAttribute("aria-labelledby", id);
  const title = element("div", "mb-1 text-xs font-semibold text-muted-foreground");
  title.id = id;
  title.textContent = "Footnotes";
  const list = element("div", "flex flex-col");
  list.setAttribute("role", "list");
  footnotes.forEach((footnote, index) => {
    const item = element("div");
    item.setAttribute("role", "listitem");
    const number = element("span", "shrink-0 text-muted-foreground tabular-nums");
    number.textContent = `${index + 1}.`;
    const text = element("span", footnote.text ? "min-w-0 flex-1 whitespace-pre-wrap" : "min-w-0 flex-1 text-muted-foreground italic");
    text.textContent = footnote.text || "Empty footnote";
    if (settings.readOnly) {
      item.className = "flex items-baseline gap-2 px-1.5 py-0.5";
      item.append(number, text);
    } else {
      const button = element("button", LIST_BUTTON_CLASS);
      button.type = "button";
      button.dataset.roving = "";
      button.dataset.footnoteItem = String(index + 1);
      button.tabIndex = index === 0 ? 0 : -1;
      button.setAttribute("aria-haspopup", "dialog");
      button.append(number, text);
      button.addEventListener("click", () => {
        const entry = footnoteList(view.state.doc)[index];
        if (entry) openFootnote(view, entry.pos, "list");
      });
      item.append(button);
    }
    list.append(item);
  });
  rovingKeys(list, () => view.focus());
  node.append(title, list);
  return node;
}

let idCounter = 0;
function uniqueId(prefix: string): string {
  idCounter += 1;
  return `ai-ui-${prefix}-${idCounter}`;
}

function hash(text: string): string {
  let value = 5381;
  for (let index = 0; index < text.length; index++) value = (value * 33) ^ text.charCodeAt(index);
  return (value >>> 0).toString(36);
}

function buildDecorations(doc: ProseMirrorNode, state: Omit<DocumentState, "decorations">, settings: DocumentSettings): DecorationSet {
  const decorations: Decoration[] = [];
  const end = doc.content.size;
  if (state.paged) {
    const page = PAGE_SIZES[state.size];
    const pages = state.breaks.length + 1;
    const date = formatPageDate();
    const fill = (template: string, number: number) => fillPageTemplate(template, { page: number, pages, title: settings.title, date });
    const base = `${state.size}:${settings.readOnly ? "r" : "w"}`;
    const head = fill(settings.header, 1);
    decorations.push(Decoration.widget(0, (view) => pageHeadDom(view, settings, page, head), { side: -1, key: `page-head:${base}:${hash(head)}`, ignoreSelection: true }));
    state.breaks.forEach((at, index) => {
      const footer = fill(settings.footer, index + 1);
      const header = fill(settings.header, index + 2);
      const pos = Math.min(at.pos, end);
      decorations.push(
        Decoration.widget(pos, (view) => pageGapDom(view, settings, page, at.fill, footer, header), {
          side: pos === end ? 1 : -1,
          key: `page-gap:${base}:${index}:${at.fill.toFixed(1)}:${hash(footer + "\n" + header)}`,
          ignoreSelection: true,
        }),
      );
    });
    const tail = fill(settings.footer, pages);
    decorations.push(Decoration.widget(end, (view) => pageTailDom(view, settings, page, state.lastFill, tail), { side: 3, key: `page-tail:${base}:${state.lastFill.toFixed(1)}:${hash(tail)}`, ignoreSelection: true }));
  }
  if (settings.enabled && state.footnotes.length) {
    const texts = state.footnotes.map((footnote) => footnote.text);
    decorations.push(
      Decoration.widget(end, (view) => footnotesDom(view, settings, state.footnotes), {
        side: 2,
        key: `footnotes:${settings.readOnly ? "r" : "w"}:${texts.length}:${hash(texts.join("\u0000"))}`,
        ignoreSelection: true,
        stopEvent: () => true,
      }),
    );
  }
  return DecorationSet.create(doc, decorations);
}

function sameTexts(a: readonly FootnoteEntry[], b: readonly FootnoteEntry[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry.text === b[index]!.text);
}

function sameFlow(a: DocumentState, breaks: readonly PageBreakAt[], lastFill: number): boolean {
  return a.breaks.length === breaks.length && Math.abs(a.lastFill - lastFill) < 0.5 && a.breaks.every((at, index) => at.pos === breaks[index]!.pos && Math.abs(at.fill - breaks[index]!.fill) < 0.5);
}

/* ------------------------------------------------------------------ */
/* Node views                                                          */
/* ------------------------------------------------------------------ */

interface DocumentContext {
  getSettings: () => DocumentSettings;
  announce: (message: string) => void;
  footnotes: Set<FootnoteView>;
  tocs: Set<TocView>;
}

const SELECTED_OUTLINE = "[&.ProseMirror-selectednode]:outline-2 [&.ProseMirror-selectednode]:outline-offset-2 [&.ProseMirror-selectednode]:outline-primary";

/** A labeled separator; page layout starts a new page after it. */
function pageBreakView(): NodeView {
  const dom = element("div", `my-4 flex items-center gap-3 rounded-sm text-xs font-medium text-muted-foreground select-none ${SELECTED_OUTLINE}`);
  dom.contentEditable = "false";
  dom.dataset.pageBreak = "";
  dom.setAttribute("role", "separator");
  dom.setAttribute("aria-label", "Page break");
  const line = () => {
    const node = element("span", "h-0 flex-1 border-t border-dashed border-muted-foreground/60");
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  const label = element("span");
  label.textContent = "Page break";
  dom.append(line(), label, line());
  return { dom, ignoreMutation: () => true };
}

/** Scrolls the nearest scrolling ancestor so `target` sits near its top. */
function scrollToTop(target: HTMLElement): void {
  let parent = target.parentElement;
  while (parent && !(parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY))) parent = parent.parentElement;
  if (!parent) {
    target.scrollIntoView({ block: "nearest" });
    return;
  }
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const offset = target.getBoundingClientRect().top - parent.getBoundingClientRect().top;
  parent.scrollTo({ top: parent.scrollTop + offset - 16, behavior: reduce ? "auto" : "smooth" });
}

/** Moves the cursor to the start of the heading at `pos`, focuses the editor and scrolls the heading into view. */
export function goToHeading(view: EditorView, pos: number): boolean {
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "heading") return false;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)));
  view.focus();
  const dom = view.nodeDOM(pos);
  if (dom instanceof HTMLElement) scrollToTop(dom);
  return true;
}

interface TocEntry {
  level: number;
  text: string;
  pos: number;
  page: number | null;
}

class TocView implements NodeView {
  readonly dom: HTMLElement;
  private readonly list: HTMLElement;
  private readonly empty: HTMLElement;
  private signature = "";

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly context: DocumentContext,
  ) {
    const id = uniqueId("toc");
    this.dom = element("div", `my-4 rounded-lg border border-border px-4 py-3 select-none ${SELECTED_OUTLINE}`);
    this.dom.contentEditable = "false";
    this.dom.dataset.toc = "";
    this.dom.setAttribute("role", "group");
    this.dom.setAttribute("aria-labelledby", id);
    const title = element("div", "mb-1.5 text-sm font-semibold text-foreground");
    title.id = id;
    title.textContent = "Table of contents";
    this.list = element("div", "flex flex-col");
    this.list.setAttribute("role", "list");
    this.empty = element("div", "text-sm text-muted-foreground");
    this.empty.textContent = "Add headings to build the table of contents";
    this.dom.append(title, this.list, this.empty);
    rovingKeys(this.list, () => this.selectSelf());
    this.list.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button[data-pos]");
      if (!button) return;
      const index = Number(button.dataset.index);
      const heading = tocHeadings(this.view.state.doc)[index];
      if (heading && goToHeading(this.view, heading.pos)) this.context.announce(`Moved to ${heading.text}`);
    });
    context.tocs.add(this);
  }

  /** Shows `entries`, rebuilding only when their text, levels or pages changed. */
  render(entries: readonly TocEntry[]): void {
    const signature = JSON.stringify(entries.map((entry) => [entry.level, entry.text, entry.page]));
    if (signature === this.signature) return;
    this.signature = signature;
    const focused = this.list.contains(document.activeElement) ? [...this.list.querySelectorAll("button")].indexOf(document.activeElement as HTMLButtonElement) : -1;
    const items = entries.map((entry, index) => {
      const item = element("div", entry.level === 1 ? "" : entry.level === 2 ? "ps-4" : "ps-8");
      item.setAttribute("role", "listitem");
      const button = element("button", LIST_BUTTON_CLASS);
      button.type = "button";
      button.dataset.roving = "";
      button.dataset.index = String(index);
      button.dataset.pos = String(entry.pos);
      button.tabIndex = index === Math.max(0, Math.min(focused, entries.length - 1)) ? 0 : -1;
      const text = element("span", "min-w-0 flex-1 truncate");
      text.textContent = entry.text;
      button.append(text);
      if (entry.page !== null) {
        const page = element("span", "shrink-0 text-muted-foreground tabular-nums");
        page.setAttribute("aria-hidden", "true");
        page.textContent = String(entry.page);
        const spoken = element("span", "sr-only");
        spoken.textContent = `, page ${entry.page}`;
        button.append(page, spoken);
      }
      item.append(button);
      return item;
    });
    this.list.replaceChildren(...items);
    this.list.hidden = entries.length === 0;
    this.empty.hidden = entries.length > 0;
    if (focused >= 0) this.list.querySelectorAll("button")[Math.min(focused, entries.length - 1)]?.focus();
  }

  /** Focuses the first entry; false when there are none. */
  focusFirst(): boolean {
    const button = this.list.querySelector<HTMLButtonElement>("button[tabindex='0']") ?? this.list.querySelector("button");
    button?.focus();
    return Boolean(button);
  }

  private selectSelf(): void {
    const pos = this.getPos();
    if (pos !== undefined) this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)));
    this.view.focus();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Element && event.target !== this.dom && Boolean(event.target.closest("button"));
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.context.tocs.delete(this);
  }
}

class FootnoteView implements NodeView {
  readonly dom: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly tip: HTMLElement;
  private number = -1;

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly context: DocumentContext,
  ) {
    this.dom = element("sup", `group relative rounded-sm ${SELECTED_OUTLINE}`);
    this.dom.contentEditable = "false";
    this.dom.dataset.footnote = "";
    this.button = element("button", "mx-px cursor-pointer rounded-sm px-0.5 leading-none font-semibold text-primary tabular-nums underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring");
    this.button.type = "button";
    this.button.tabIndex = -1;
    this.tip = element(
      "span",
      "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-64 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-left align-baseline text-xs leading-snug font-normal whitespace-pre-wrap text-background shadow-md group-hover:block group-focus-within:block group-[.ProseMirror-selectednode]:block group-data-[editing]:invisible",
    );
    this.tip.id = uniqueId("footnote-tip");
    this.tip.setAttribute("role", "tooltip");
    this.button.setAttribute("aria-describedby", this.tip.id);
    this.dom.append(this.button, this.tip);
    this.button.addEventListener("click", (event) => {
      event.preventDefault();
      const settings = this.context.getSettings();
      const pos = this.getPos();
      if (pos !== undefined && settings.enabled && !settings.readOnly) openFootnote(this.view, pos, "reference");
    });
    this.button.addEventListener("keydown", (event) => {
      const pos = this.getPos();
      if (pos === undefined) return;
      const doc = this.view.state.doc;
      let selection;
      if (event.key === "Escape") selection = NodeSelection.create(doc, pos);
      else if (event.key === "ArrowLeft") selection = TextSelection.create(doc, pos);
      else if (event.key === "ArrowRight") selection = TextSelection.create(doc, pos + 1);
      else return;
      event.preventDefault();
      this.view.dispatch(this.view.state.tr.setSelection(selection));
      this.view.focus();
    });
    this.setText();
    context.footnotes.add(this);
  }

  /** The footnote's current position, for numbering. */
  position(): number | undefined {
    return this.getPos();
  }

  /** Updates the number and whether the footnote's editor is open (which hides the hover text). */
  setNumber(number: number, editable: boolean, editing: boolean): void {
    this.dom.toggleAttribute("data-editing", editing);
    if (editable) this.button.setAttribute("aria-haspopup", "dialog");
    else this.button.removeAttribute("aria-haspopup");
    if (number === this.number) return;
    this.number = number;
    this.button.textContent = number > 0 ? String(number) : "*";
    this.button.setAttribute("aria-label", number > 0 ? `Footnote ${number}` : "Footnote");
  }

  private setText(): void {
    this.tip.textContent = (this.node.attrs.text as string) || "Empty footnote";
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.setText();
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.button.contains(event.target);
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.context.footnotes.delete(this);
  }
}

/* ------------------------------------------------------------------ */
/* Plugin view: measuring, numbering and announcing                    */
/* ------------------------------------------------------------------ */

function gapBetween(previous: Element | null, current: Element): boolean {
  for (let node = current.previousElementSibling; node && node !== previous; node = node.previousElementSibling) {
    if (node instanceof HTMLElement && node.dataset.pageGap !== undefined) return true;
  }
  return false;
}

const nextFrame = (callback: () => void): number => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : (setTimeout(callback, 16) as unknown as number));
const cancelFrame = (id: number): void => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id));

class DocumentView {
  private frame = 0;
  private observer: ResizeObserver | null = null;
  private parentWidth = -1;
  private streak = 0;
  private pointerDown = false;
  private deferred = false;
  private afterEdit = false;
  private zoomDirty = true;
  private readOnly: boolean;
  private readonly onPointerDown = () => {
    this.pointerDown = true;
  };
  private readonly onPointerUp = () => {
    this.pointerDown = false;
    if (this.deferred) this.schedule();
  };
  private readonly onCompositionEnd = () => {
    if (this.deferred) this.schedule();
  };

  constructor(
    private readonly view: EditorView,
    private readonly context: DocumentContext,
  ) {
    this.readOnly = context.getSettings().readOnly;
    view.dom.addEventListener("pointerdown", this.onPointerDown);
    view.dom.addEventListener("compositionend", this.onCompositionEnd);
    view.dom.ownerDocument.addEventListener("pointerup", this.onPointerUp);
    view.dom.ownerDocument.addEventListener("pointercancel", this.onPointerUp);
    const parent = view.dom.parentElement;
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === parent && entry.contentRect.width !== this.parentWidth) {
            this.parentWidth = entry.contentRect.width;
            this.streak = 0;
            this.zoomDirty = true;
          }
        }
        if (documentKey.getState(this.view.state)?.paged) this.schedule();
      });
      this.observer.observe(view.dom);
      if (parent) this.observer.observe(parent);
    }
    this.refresh();
    this.applyZoom();
    this.schedule();
  }

  update(view: EditorView, previous: EditorState): void {
    const state = documentKey.getState(view.state);
    const before = documentKey.getState(previous);
    if (!state) return;
    const readOnly = this.context.getSettings().readOnly;
    const docChanged = view.state.doc !== previous.doc;
    if (docChanged) {
      this.streak = 0;
      this.afterEdit = true;
    }
    if (docChanged || state !== before || readOnly !== this.readOnly) this.refresh();
    this.readOnly = readOnly;
    if (state.paged !== before?.paged || state.size !== before?.size) {
      this.streak = 0;
      this.zoomDirty = true;
      this.applyZoom();
    }
    if (state.paged && (docChanged || state !== before)) this.schedule();
    if (!view.state.selection.eq(previous.selection)) this.announceSelection();
  }

  /** Numbers footnotes and refreshes tables of contents. */
  private refresh(): void {
    const state = documentKey.getState(this.view.state);
    if (!state) return;
    const settings = this.context.getSettings();
    if (this.context.footnotes.size) {
      const numbers = new Map(state.footnotes.map((entry, index) => [entry.pos, index + 1]));
      const editable = settings.enabled && !settings.readOnly;
      for (const footnote of this.context.footnotes) {
        const pos = footnote.position();
        footnote.setNumber(pos === undefined ? 0 : (numbers.get(pos) ?? 0), editable, pos !== undefined && pos === state.editing?.pos);
      }
    }
    if (this.context.tocs.size) {
      const starts = state.breaks.map((at) => at.pos);
      const entries = tocHeadings(this.view.state.doc).map((heading) => ({ ...heading, page: state.paged ? pageAt(starts, heading.pos) : null }));
      for (const toc of this.context.tocs) toc.render(entries);
    }
  }

  private announceSelection(): void {
    const { selection } = this.view.state;
    if (!(selection instanceof NodeSelection) || !this.view.hasFocus()) return;
    const settings = this.context.getSettings();
    const editable = settings.enabled && !settings.readOnly;
    const { node } = selection;
    if (node.type.name === "footnote") {
      const number = (documentKey.getState(this.view.state)?.footnotes.findIndex((entry) => entry.pos === selection.from) ?? -1) + 1;
      const text = (node.attrs.text as string) || "empty";
      this.context.announce(`Footnote ${number}: ${text}${/[.!?]$/.test(text) ? "" : "."}${editable ? " Press Enter to edit." : ""}`);
    } else if (node.type.name === "toc") this.context.announce("Table of contents. Press Enter to choose a heading.");
    else if (node.type.name === "page_break") this.context.announce("Page break");
  }

  /** Scales the paper down to fit narrow surfaces. */
  private applyZoom(): void {
    this.zoomDirty = false;
    const dom = this.view.dom as HTMLElement;
    const state = documentKey.getState(this.view.state);
    const parent = dom.parentElement;
    if (!state?.paged || !parent) {
      if (dom.style.zoom) dom.style.zoom = "";
      return;
    }
    const style = getComputedStyle(parent);
    const available = parent.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0) - 2 * DESK_GUTTER;
    if (available <= 0) {
      this.zoomDirty = true;
      return;
    }
    const scale = Math.max(MIN_SCALE, Math.min(1, Math.floor((available / PAGE_SIZES[state.size].width) * 1000) / 1000));
    const value = scale >= 1 ? "" : String(scale);
    if (dom.style.zoom !== value) dom.style.zoom = value;
  }

  private schedule(): void {
    if (!this.frame) this.frame = nextFrame(() => this.measure());
  }

  /** Measures top-level blocks after layout and updates page breaks when they moved. */
  private measure(): void {
    this.frame = 0;
    const { view } = this;
    if (view.isDestroyed) return;
    const state = documentKey.getState(view.state);
    if (!state?.paged) return;
    if (view.composing || this.pointerDown) {
      this.deferred = true;
      return;
    }
    this.deferred = false;
    if (this.zoomDirty) this.applyZoom();
    const dom = view.dom as HTMLElement;
    const paper = dom.getBoundingClientRect();
    const page = PAGE_SIZES[state.size];
    if (paper.width < 1) return;
    const scale = paper.width / page.width;
    const blocks: PageBlock[] = [];
    const positions: number[] = [];
    let previous: Element | null = null;
    let previousBottom = 0;
    let previousMargin = 0;
    let afterBreak = false;
    const add = (node: HTMLElement, pos: number, hang: boolean) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const top = (rect.top - paper.top) / scale;
      const bottom = (rect.bottom - paper.top) / scale;
      const marginTop = Number.parseFloat(style.marginTop) || 0;
      const marginBottom = Number.parseFloat(style.marginBottom) || 0;
      const spacingBefore = previous && !gapBetween(previous, node) ? top - previousBottom : collapseMargins(previousMargin, marginTop);
      blocks.push({ height: Math.max(0, bottom - top), marginTop, marginBottom, spacingBefore, breakBefore: afterBreak, hang });
      positions.push(pos);
      previous = node;
      previousBottom = bottom;
      previousMargin = marginBottom;
    };
    view.state.doc.forEach((node, offset) => {
      // Node decorations from other plugins may wrap a block; measure the outermost element.
      let target = view.nodeDOM(offset);
      while (target && target.parentNode !== dom) target = target.parentNode;
      const isBreak = node.type.name === "page_break";
      if (target instanceof HTMLElement) {
        add(target, offset, isBreak);
        afterBreak = isBreak;
      } else if (isBreak) afterBreak = true;
    });
    const list = [...dom.children].find((child): child is HTMLElement => child instanceof HTMLElement && child.dataset.footnotesList !== undefined);
    if (list) add(list, view.state.doc.content.size, false);
    const flow = paginate(blocks, page.contentHeight);
    const round = (value: number) => Math.round(value * 100) / 100;
    const breaks = flow.breaks.map((at) => ({ pos: positions[at.index]!, fill: round(at.fill) }));
    const lastFill = round(flow.lastFill);
    if (sameFlow(state, breaks, lastFill)) {
      this.streak = 0;
      this.afterEdit = false;
      return;
    }
    if (this.streak >= MAX_STREAK) return;
    this.streak += 1;
    const tr = view.state.tr.setMeta(documentKey, { pages: { breaks, lastFill } } satisfies DocumentMeta).setMeta("addToHistory", false);
    if (this.afterEdit && view.hasFocus()) tr.scrollIntoView();
    this.afterEdit = false;
    view.dispatch(tr);
  }

  destroy(): void {
    if (this.frame) cancelFrame(this.frame);
    this.observer?.disconnect();
    const dom = this.view.dom as HTMLElement;
    dom.removeEventListener("pointerdown", this.onPointerDown);
    dom.removeEventListener("compositionend", this.onCompositionEnd);
    dom.ownerDocument.removeEventListener("pointerup", this.onPointerUp);
    dom.ownerDocument.removeEventListener("pointercancel", this.onPointerUp);
    if (dom.style.zoom) dom.style.zoom = "";
  }
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export interface DocumentFeatureOptions {
  /** Current settings, read whenever they are needed. */
  getSettings: () => DocumentSettings;
  /** Announces a message politely. */
  announce: (message: string) => void;
}

/** Plugins and node views for page layout, page breaks, the table of contents and footnotes. */
export function createDocumentFeature({ getSettings, announce }: DocumentFeatureOptions): { plugins: Plugin[]; nodeViews: Record<string, NodeViewConstructor> } {
  const context: DocumentContext = { getSettings, announce, footnotes: new Set(), tocs: new Set() };
  const editable = () => {
    const settings = getSettings();
    return settings.enabled && !settings.readOnly;
  };
  const guard =
    (command: Command): Command =>
    (state, dispatch, view) =>
      editable() && command(state, dispatch, view);

  const plugin = new Plugin<DocumentState>({
    key: documentKey,
    state: {
      init: (_config, state) => {
        const settings = getSettings();
        const base = { paged: settings.enabled && settings.layout === "page", size: settings.pageSize, breaks: [], lastFill: 0, editing: null, footnotes: footnoteList(state.doc) };
        return { ...base, decorations: buildDecorations(state.doc, base, settings) };
      },
      apply: (tr, previous, _old, state) => {
        const meta = tr.getMeta(documentKey) as DocumentMeta | undefined;
        const settings = getSettings();
        const paged = settings.enabled && settings.layout === "page";
        const size = PAGE_SIZES[settings.pageSize] ? settings.pageSize : "letter";
        const propsChanged = Boolean(tr.getMeta(HTML_EDITOR_PROPS_META));
        if (!tr.docChanged && !meta && !propsChanged && paged === previous.paged && size === previous.size && (settings.enabled || !previous.editing)) return previous;
        let { breaks, lastFill, editing, footnotes } = previous;
        let rebuild = propsChanged || paged !== previous.paged || size !== previous.size;
        if (tr.docChanged) {
          const seen = new Set<number>();
          const mapped = breaks.map((at) => ({ ...at, pos: tr.mapping.map(at.pos, -1) }));
          breaks = mapped.filter((at) => {
            const valid = at.pos > 0 && at.pos <= state.doc.content.size && state.doc.resolve(at.pos).depth === 0 && !seen.has(at.pos);
            seen.add(at.pos);
            return valid;
          });
          // Widgets map along with the text; a break that no longer sits between top-level blocks needs a redraw.
          if (breaks.length !== mapped.length) rebuild = true;
          if (editing) {
            const mapped = tr.mapping.mapResult(editing.pos);
            editing = !mapped.deleted && state.doc.nodeAt(mapped.pos)?.type.name === "footnote" ? { ...editing, pos: mapped.pos } : null;
          }
          const next = footnoteList(state.doc);
          if (!sameTexts(next, footnotes)) rebuild = true;
          footnotes = next;
        }
        if (meta?.pages) {
          breaks = meta.pages.breaks;
          lastFill = meta.pages.lastFill;
          rebuild = true;
        }
        if (meta && "edit" in meta) editing = meta.edit ? { ...meta.edit, serial: (previous.editing?.serial ?? 0) + 1 } : null;
        if (!paged || ((paged !== previous.paged || size !== previous.size) && !meta?.pages)) {
          breaks = [];
          lastFill = 0;
        }
        if (!settings.enabled) editing = null;
        const next = { paged, size, breaks, lastFill, editing, footnotes };
        return { ...next, decorations: rebuild ? buildDecorations(state.doc, next, settings) : previous.decorations.map(tr.mapping, tr.doc) };
      },
    },
    props: {
      decorations: (state) => documentKey.getState(state)?.decorations ?? null,
      attributes: (state): Record<string, string> => {
        const current = documentKey.getState(state);
        if (!current?.paged) return {};
        const page = PAGE_SIZES[current.size];
        return { class: PAPER_CLASS, style: `width:${page.width}px;padding:0 ${page.margin}px;margin:${DESK_MARGIN}px auto;box-sizing:border-box;min-height:0`, "data-page-size": current.size };
      },
      handleKeyDown: (view, event) => {
        const { selection } = view.state;
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || !(selection instanceof NodeSelection) || !getSettings().enabled) return false;
        if (selection.node.type.name === "footnote" && editable()) return openFootnote(view, selection.from, "reference");
        if (selection.node.type.name === "toc") {
          for (const toc of context.tocs) if (toc.dom === view.nodeDOM(selection.from)) return toc.focusFirst();
        }
        return false;
      },
    },
    view: (view) => new DocumentView(view, context),
  });

  return {
    plugins: [plugin, keymap({ "Mod-Enter": guard(insertPageBreak), "Mod-Alt-f": guard(insertFootnote) })],
    nodeViews: {
      page_break: () => pageBreakView(),
      toc: (node, view, getPos) => new TocView(node, view, getPos, context),
      footnote: (node, view, getPos) => new FootnoteView(node, view, getPos, context),
    },
  };
}
