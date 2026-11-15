// packages/ai-ui/src/lib/rich-text/html-ai.ts
import { DOMSerializer, Fragment, type Mark, type Node as ProseMirrorNode, type Schema, Slice } from "prosemirror-model";
import { AllSelection, type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "prosemirror-state";
import { keydownHandler } from "prosemirror-keymap";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

import type { HtmlAiAction, HtmlAiRequest } from "../../components/html-editor-extension.js";

/** Characters of plain text sent before and after the target as context. */
export const HTML_AI_CONTEXT_LENGTH = 1500;

/** The AI menu's presets when `aiActions` is not set. */
export const DEFAULT_HTML_AI_ACTIONS: readonly HtmlAiAction[] = [
  { id: "rewrite", label: "Improve writing", group: "Edit", instruction: "Rewrite this text so it is clearer and reads better. Keep the meaning, facts and language. Reply with the rewritten text only." },
  { id: "fix", label: "Fix spelling and grammar", group: "Edit", instruction: "Fix spelling, grammar and punctuation in this text. Change nothing else. Reply with the corrected text only." },
  { id: "shorten", label: "Make shorter", group: "Edit", instruction: "Make this text shorter. Keep the key facts. Reply with the shorter text only." },
  { id: "expand", label: "Make longer", group: "Edit", instruction: "Make this text longer with useful, relevant detail. Keep the meaning and tone. Reply with the longer text only." },
  { id: "tone-professional", label: "Professional", group: "Tone", instruction: "Rewrite this text in a professional tone. Keep the meaning. Reply with the rewritten text only." },
  { id: "tone-friendly", label: "Friendly", group: "Tone", instruction: "Rewrite this text in a warm, friendly tone. Keep the meaning. Reply with the rewritten text only." },
  { id: "tone-confident", label: "Confident", group: "Tone", instruction: "Rewrite this text in a confident, direct tone. Keep the meaning. Reply with the rewritten text only." },
  { id: "tone-casual", label: "Casual", group: "Tone", instruction: "Rewrite this text in a relaxed, casual tone. Keep the meaning. Reply with the rewritten text only." },
  { id: "continue", label: "Continue writing", group: "Write", scope: "cursor", instruction: "Continue writing from the cursor in the same style and tone as the text before it. Reply with the new text only." },
  { id: "summarize", label: "Summarize", group: "Write", instruction: "Summarize this text in a few sentences. Reply with the summary only." },
];

/** What the AI acts on: the selected text, or the cursor when nothing with text is selected. */
export interface HtmlAiRange {
  from: number;
  to: number;
}

/** The AI target for the current selection; `hasText` is false for a cursor or a selection without text. */
export function aiSelectionRange(state: EditorState): HtmlAiRange & { hasText: boolean } {
  const { selection } = state;
  const textual = selection instanceof TextSelection || selection instanceof AllSelection;
  if (textual && !selection.empty && rangePlainText(state.doc, selection.from, selection.to).trim()) return { from: selection.from, to: selection.to, hasText: true };
  const at = textual ? selection.head : selection.to;
  return { from: at, to: at, hasText: false };
}

function isDeleted(node: ProseMirrorNode): boolean {
  const deletion = node.type.schema.marks.deletion;
  return Boolean(deletion?.isInSet(node.marks));
}

/**
 * Plain text between two positions as a reader sees it: paragraphs separated
 * by a blank line, hard breaks as newlines, tracked deletions left out.
 */
export function rangePlainText(doc: ProseMirrorNode, from: number, to: number): string {
  let text = "";
  let first = true;
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      if (first) first = false;
      else text += "\n\n";
      return true;
    }
    if (node.isText) {
      if (!isDeleted(node)) text += node.text!.slice(Math.max(from, pos) - pos, to - pos);
      return false;
    }
    if (node.type.name === "hard_break" && !isDeleted(node)) text += "\n";
    return true;
  });
  return text;
}

/** The last `max` characters of `text`, starting at a word boundary when the cut falls inside a word. */
export function clipStart(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(text.length - max);
  if (/\s/.test(text.charAt(text.length - max - 1))) return cut;
  const space = cut.search(/\s/);
  return space >= 0 && space < 40 ? cut.slice(space + 1) : cut;
}

/** The first `max` characters of `text`, ending at a word boundary when the cut falls inside a word. */
export function clipEnd(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  if (/\s/.test(text.charAt(max))) return cut;
  const space = cut.search(/\s\S*$/);
  return space >= 0 && max - space < 40 ? cut.slice(0, space) : cut;
}

/**
 * The content between two positions as HTML, serialized through the schema
 * (so it only holds what the schema allows). Wrappers the range sits inside,
 * such as the paragraph of a selection within one paragraph, are left out.
 */
export function sliceHtml(doc: ProseMirrorNode, from: number, to: number): string {
  if (from >= to || typeof document === "undefined") return "";
  const slice = doc.slice(from, to);
  let { content, openStart, openEnd } = slice;
  while (content.childCount === 1 && openStart > 0 && openEnd > 0 && !content.firstChild!.isLeaf) {
    content = content.firstChild!.content;
    openStart -= 1;
    openEnd -= 1;
  }
  const target = document.implementation.createHTMLDocument("");
  const container = target.createElement("div");
  container.append(DOMSerializer.fromSchema(doc.type.schema).serializeFragment(content, { document: target }));
  return container.innerHTML;
}

/** Builds what `onAiRequest` receives for an action on a range; cursor actions send no selected text. */
export function buildAiRequest(state: EditorState, range: HtmlAiRange, action: HtmlAiAction, prompt?: string): HtmlAiRequest {
  const { doc } = state;
  const cursor = (action.scope ?? "selection") === "cursor" || range.from === range.to;
  const from = cursor ? range.to : range.from;
  const to = range.to;
  const typed = prompt?.trim();
  return {
    action: action.id,
    instruction: action.instruction,
    text: cursor ? "" : rangePlainText(doc, from, to),
    html: cursor ? "" : sliceHtml(doc, from, to),
    before: clipStart(rangePlainText(doc, 0, from), HTML_AI_CONTEXT_LENGTH),
    after: clipEnd(rangePlainText(doc, to, doc.content.size), HTML_AI_CONTEXT_LENGTH),
    ...(typed ? { prompt: typed } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Reading the handler's result                                        */
/* ------------------------------------------------------------------ */

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

const ABORTED = Symbol("aborted");

/** Settles with the promise, or with ABORTED as soon as the signal aborts; a later rejection is still handled. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T | typeof ABORTED> {
  return new Promise((resolve, reject) => {
    const onAbort = () => resolve(ABORTED);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (reason: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      },
    );
  });
}

/**
 * Reads an AI handler's result, an async iterable of chunks or a promise of
 * the whole text, calling `onText` with the text so far. Resolves with what
 * arrived when the result ends or as soon as `signal` aborts, even if the
 * handler ignores the signal; rejects when the handler fails.
 */
export async function collectAiText(result: AsyncIterable<string> | Promise<string> | string, signal: AbortSignal, onText: (text: string) => void): Promise<string> {
  if (!isAsyncIterable(result)) {
    const value = await untilAborted(Promise.resolve(result), signal);
    if (value === ABORTED) return "";
    const text = typeof value === "string" ? value : String(value ?? "");
    onText(text);
    return text;
  }
  const iterator = result[Symbol.asyncIterator]();
  let text = "";
  for (;;) {
    const step = await untilAborted(iterator.next(), signal);
    if (step === ABORTED) {
      void Promise.resolve(iterator.return?.()).catch(() => undefined);
      return text;
    }
    if (step.done) return text;
    if (step.value === undefined || step.value === null) continue;
    text += typeof step.value === "string" ? step.value : String(step.value);
    onText(text);
  }
}

/* ------------------------------------------------------------------ */
/* Inserting results                                                   */
/* ------------------------------------------------------------------ */

/** How a result goes into the document: in place of the range (or at the cursor), as paragraphs below its block, or as a tracked change. */
export type HtmlAiInsertMode = "replace" | "below" | "suggest";

export interface HtmlAiInsertOptions {
  /** Author on suggested changes. */
  author?: string;
  /** ISO date on suggested changes; defaults to now. */
  date?: string;
  /** Makes change ids; defaults to `newChangeId`. */
  newId?: () => string;
}

/** A unique id for a tracked change that passes `safeMarkId`. */
export function newChangeId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Normalized line endings, control characters removed, and blank lines that hold only spaces emptied. */
function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/(?![\t\n])\p{Cc}/gu, "")
    .replace(/[^\S\n]+\n/g, "\n");
}

/** Paragraphs of a plain text result, split at blank lines. */
export function aiParagraphs(text: string): string[] {
  return cleanText(text)
    .replace(/^\n+|\n+$/g, "")
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim());
}

function inlineNodes(schema: Schema, text: string, marks: readonly Mark[]): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  text.split("\n").forEach((line, index) => {
    if (index > 0 && schema.nodes.hard_break) nodes.push(schema.nodes.hard_break.create(null, null, marks));
    if (line) nodes.push(schema.text(line, marks));
  });
  return nodes;
}

const LIST_TYPES = new Set(["bullet_list", "ordered_list", "list_item", "task_list", "task_item"]);

/** The position after the block holding `pos`, outside any list it is in. */
export function blockEnd(doc: ProseMirrorNode, pos: number): number {
  const $pos = doc.resolve(pos);
  let depth = $pos.depth;
  if (depth === 0) return pos;
  while (depth > 1 && LIST_TYPES.has($pos.node(depth - 1).type.name)) depth -= 1;
  return $pos.after(depth);
}

function splittable(node: ProseMirrorNode): boolean {
  return (node.type.name === "paragraph" || node.type.name === "heading") && !node.type.spec.isolating;
}

/** Marks the new text carries: those across the replaced range, without tracked change marks. */
function carriedMarks(doc: ProseMirrorNode, from: number, to: number): readonly Mark[] {
  const $from = doc.resolve(from);
  const marks = from === to ? $from.marks() : ($from.marksAcross(doc.resolve(to)) ?? []);
  return marks.filter((mark) => mark.type.name !== "insertion" && mark.type.name !== "deletion");
}

/** The selection's own leading and trailing spaces around a trimmed result, so replacing "word " keeps its space. */
function keepEdgeSpaces(original: string, result: string): string {
  const trimmed = result.replace(/^[^\S\n]+|[^\S\n]+$/g, "");
  return `${/^[^\S\n]+/.exec(original)?.[0] ?? ""}${trimmed}${/[^\S\n]+$/.exec(original)?.[0] ?? ""}`;
}

/** Places `text` at from..to inside a transaction, as inline content or split into paragraphs; returns the position after it. */
function placeText(tr: Transaction, from: number, to: number, text: string, marks: readonly Mark[]): number {
  const schema = tr.doc.type.schema;
  const $from = tr.doc.resolve(from);
  const $to = tr.doc.resolve(to);
  const end = () => tr.mapping.map(to, 1);
  if ($from.sameParent($to) && $from.parent.type.spec.code) {
    const plain = cleanText(text).replace(/^\n+|\n+$/g, "");
    if (plain) tr.replaceWith(from, to, schema.text(plain));
    else tr.delete(from, to);
    return end();
  }
  const paragraphs = cleanText(text)
    .replace(/^\n+|\n+$/g, "")
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim());
  if (!paragraphs.length) {
    tr.delete(from, to);
    return end();
  }
  const inline = paragraphs.length === 1 || ($from.sameParent($to) && $from.parent.inlineContent && !splittable($from.parent));
  try {
    if (inline) tr.replaceWith(from, to, inlineNodes(schema, paragraphs.join("\n"), marks));
    else {
      const blocks = paragraphs.map((paragraph) => schema.nodes.paragraph!.create(null, inlineNodes(schema, paragraph, marks)));
      tr.replace(from, to, new Slice(Fragment.from(blocks), 1, 1));
    }
  } catch {
    // A failed step is never added, so the transaction is unchanged here; fall back to one line of text.
    tr.replaceWith(from, to, schema.text(paragraphs.join(" ").replace(/\s+/g, " "), marks));
  }
  return end();
}

/**
 * A transaction that puts an AI result into the document as plain text:
 * blank-line separated paragraphs become paragraphs, single newlines hard
 * breaks, and every node is built from the schema. "replace" swaps the
 * range for the text, or inserts at the cursor for an empty range; "below"
 * adds paragraphs after the range's block; "suggest" marks the old text as
 * a deletion and inserts the new text as an insertion. Null when the
 * result holds no text.
 */
export function insertAiText(state: EditorState, range: HtmlAiRange, text: string, mode: HtmlAiInsertMode, options: HtmlAiInsertOptions = {}): Transaction | null {
  const { doc, schema } = state;
  const from = Math.max(0, Math.min(range.from, doc.content.size));
  const to = Math.max(from, Math.min(range.to, doc.content.size));
  if (!cleanText(text).trim()) return null;
  const tr = state.tr;

  if (mode === "below") {
    const blocks = aiParagraphs(text).map((paragraph) => schema.nodes.paragraph!.create(null, inlineNodes(schema, paragraph.trim(), [])));
    const at = blockEnd(doc, to);
    tr.insert(at, blocks);
    const end = tr.mapping.map(at, 1);
    return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, end - 1)), -1));
  }

  let result = text;
  if (from < to) result = keepEdgeSpaces(rangePlainText(doc, from, to), result);
  else {
    const previous = doc.textBetween(Math.max(doc.resolve(from).start(), from - 1), from);
    result = cleanText(result).replace(/^\n+/, "");
    if (/\S/.test(previous) && /^[\p{L}\p{N}"'([]/u.test(result)) result = ` ${result}`;
  }

  let marks = carriedMarks(doc, from, to);
  let at = from;
  let until = to;
  if (mode === "suggest") {
    const author = options.author ?? "";
    const date = options.date ?? new Date().toISOString();
    const newId = options.newId ?? newChangeId;
    const insertion = schema.marks.insertion;
    const deletion = schema.marks.deletion;
    if (!insertion || !deletion) return null;
    if (from < to) {
      const removed = deletion.create({ id: newId(), author, date });
      const pending: Array<{ from: number; to: number; inserted: boolean }> = [];
      doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isInline) return true;
        if (deletion.isInSet(node.marks)) return false;
        pending.push({ from: Math.max(pos, from), to: Math.min(pos + node.nodeSize, to), inserted: Boolean(insertion.isInSet(node.marks)) });
        return false;
      });
      for (const part of pending.reverse()) {
        if (part.inserted) tr.delete(part.from, part.to);
        else tr.addMark(part.from, part.to, removed);
      }
    }
    at = tr.mapping.map(to, 1);
    until = at;
    marks = insertion.create({ id: newId(), author, date }).addToSet(marks);
  }
  const end = placeText(tr, at, until, result, marks);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(end, tr.doc.content.size)), -1));
}

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

/** The range the AI menu or preview is acting on, highlighted in the document. */
export interface HtmlAiTarget extends HtmlAiRange {
  mode: "menu" | "preview";
}

export const htmlAiKey = new PluginKey<HtmlAiTarget | null>("html-ai");

/** Transaction meta for `htmlAiKey`: show a target, or clear it. */
export type HtmlAiMeta = { type: "set"; target: HtmlAiTarget } | { type: "clear" };

export interface HtmlAiPluginOptions {
  /** Whether AI writing is on right now (a handler is set, not compact, not read-only). */
  enabled: () => boolean;
  /** Ctrl+J or Cmd+J; returns whether the menu opened. */
  open: (view: EditorView) => boolean;
  /** Escape in the document while a target is shown. */
  escape: (view: EditorView) => boolean;
  /** The target was dropped by something other than the AI flow: an edit while a preview was open, or the feature turning off. */
  lost: () => void;
}

function cursorWidget(): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "html-ai-cursor";
  marker.setAttribute("aria-hidden", "true");
  return marker;
}

/**
 * Tracks and highlights the AI target, maps it through changes while the
 * menu is open, drops it when the document is edited while a preview is
 * open, and binds Mod-j and Escape.
 */
export function htmlAiPlugin(options: HtmlAiPluginOptions): Plugin<HtmlAiTarget | null> {
  const keys = keydownHandler({ "Mod-j": (_state, _dispatch, view) => Boolean(view && options.enabled() && options.open(view)) });
  return new Plugin<HtmlAiTarget | null>({
    key: htmlAiKey,
    state: {
      init: () => null,
      apply: (tr, previous) => {
        const meta = tr.getMeta(htmlAiKey) as HtmlAiMeta | undefined;
        if (meta) return meta.type === "set" ? meta.target : null;
        if (!previous || !options.enabled()) return null;
        if (!tr.docChanged) return previous;
        if (previous.mode === "preview" && !tr.getMeta("appendedTransaction")) return null;
        const start = tr.mapping.mapResult(previous.from, 1);
        const end = tr.mapping.mapResult(previous.to, -1);
        if (previous.from < previous.to && start.deleted && end.deleted && start.pos >= end.pos) return null;
        return { ...previous, from: start.pos, to: Math.max(start.pos, end.pos) };
      },
    },
    props: {
      decorations: (state) => {
        const target = htmlAiKey.getState(state);
        if (!target) return null;
        const size = state.doc.content.size;
        if (target.from < target.to) return DecorationSet.create(state.doc, [Decoration.inline(target.from, Math.min(target.to, size), { class: "html-ai-target" })]);
        return DecorationSet.create(state.doc, [Decoration.widget(Math.min(target.from, size), cursorWidget, { side: 1, key: "html-ai-cursor", ignoreSelection: true })]);
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Escape" && htmlAiKey.getState(view.state)) return options.escape(view);
        return keys(view, event);
      },
    },
    view: () => ({
      update: (view, previous) => {
        if (htmlAiKey.getState(previous) && !htmlAiKey.getState(view.state)) options.lost();
      },
    }),
  });
}
