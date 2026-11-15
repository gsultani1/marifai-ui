// packages/ai-ui/src/lib/rich-text/plugins.ts
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView, type NodeView } from "prosemirror-view";

import { insertHorizontalRule, insertTable, setBlock, toggleList } from "./commands.js";
import { emitEditorEvent, RICH_TEXT_EVENTS } from "./events.js";

export { emitEditorEvent, RICH_TEXT_EVENTS } from "./events.js";

/* ------------------------------------------------------------------ */
/* Placeholder                                                         */
/* ------------------------------------------------------------------ */

export function placeholderPlugin(text: string): Plugin {
  return new Plugin({
    props: {
      decorations: (state) => {
        const { doc } = state;
        const first = doc.firstChild;
        if (doc.childCount !== 1 || !first?.isTextblock || first.content.size > 0) return null;
        return DecorationSet.create(doc, [Decoration.node(0, first.nodeSize, { class: "is-empty", "data-placeholder": text })]);
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Selection sync                                                      */
/* ------------------------------------------------------------------ */

/**
 * Browsers report caret moves through an asynchronous selectionchange
 * event, so a key pressed right after a click can reach ProseMirror before
 * it has read the new caret and land at the old one. Before handling a key,
 * this adopts the DOM caret when it sits in text and differs from a text
 * selection in the state. Node, cell and gap selections are left alone.
 */
export function selectionSyncPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        keydown: (view) => {
          const current = view.state.selection;
          if (!(current instanceof TextSelection) || !view.hasFocus()) return false;
          const root = view.root as Document | ShadowRoot;
          const selection = "getSelection" in root && typeof root.getSelection === "function" ? root.getSelection() : document.getSelection();
          if (!selection?.anchorNode || !selection.focusNode || !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return false;
          try {
            const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
            const head = view.posAtDOM(selection.focusNode, selection.focusOffset);
            if (anchor === current.anchor && head === current.head) return false;
            const $anchor = view.state.doc.resolve(anchor);
            const $head = view.state.doc.resolve(head);
            if (!$anchor.parent.inlineContent || !$head.parent.inlineContent) return false;
            view.dispatch(view.state.tr.setSelection(TextSelection.between($anchor, $head)));
          } catch {
            return false;
          }
          return false;
        },
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Slash commands                                                      */
/* ------------------------------------------------------------------ */

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  run: (view: EditorView) => void;
}

const runCommand = (command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean) => (view: EditorView) => {
  command(view.state, view.dispatch);
};

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "text", label: "Text", description: "Plain paragraph", keywords: ["paragraph", "body"], run: runCommand(setBlock("paragraph")) },
  { id: "h1", label: "Heading 1", description: "Large section title", keywords: ["title", "h1"], run: runCommand(setBlock("heading1")) },
  { id: "h2", label: "Heading 2", description: "Medium section title", keywords: ["subtitle", "h2"], run: runCommand(setBlock("heading2")) },
  { id: "h3", label: "Heading 3", description: "Small section title", keywords: ["h3"], run: runCommand(setBlock("heading3")) },
  { id: "bullet", label: "Bulleted list", description: "Simple list", keywords: ["ul", "unordered", "bullets"], run: runCommand(toggleList("bullet")) },
  { id: "ordered", label: "Numbered list", description: "List with numbers", keywords: ["ol", "ordered", "numbers"], run: runCommand(toggleList("ordered")) },
  { id: "task", label: "To-do list", description: "Checklist with checkboxes", keywords: ["todo", "task", "checkbox", "checklist"], run: runCommand(toggleList("task")) },
  { id: "quote", label: "Quote", description: "Indented quotation", keywords: ["blockquote", "citation"], run: runCommand(setBlock("blockquote")) },
  { id: "code", label: "Code block", description: "Monospaced code", keywords: ["pre", "snippet"], run: runCommand(setBlock("code")) },
  { id: "table", label: "Table", description: "3 × 3 table with a header row", keywords: ["grid", "rows", "columns"], run: runCommand(insertTable(3, 3)) },
  { id: "divider", label: "Divider", description: "Horizontal rule", keywords: ["hr", "line", "separator"], run: runCommand(insertHorizontalRule) },
  { id: "image", label: "Image", description: "Insert an image by URL", keywords: ["picture", "photo", "img"], run: (view) => void emitEditorEvent(view, RICH_TEXT_EVENTS.openImage) },
];

export function filterSlashCommands(query: string, commands: SlashCommand[] = SLASH_COMMANDS): SlashCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  return commands
    .map((command) => {
      const label = command.label.toLowerCase();
      const score = label.startsWith(needle) ? 0 : label.includes(needle) ? 1 : command.keywords.some((keyword) => keyword.startsWith(needle)) ? 2 : -1;
      return { command, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.command);
}

export interface SlashState {
  active: boolean;
  /** Position of the "/" that opened the menu. */
  from: number;
  query: string;
  index: number;
  dismissed: number | null;
}

export const slashKey = new PluginKey<SlashState>("slash");

const INACTIVE: SlashState = { active: false, from: 0, query: "", index: 0, dismissed: null };

type SlashMeta = { type: "dismiss" } | { type: "move"; index: number };

/**
 * Opens a command menu when "/" is typed at the start of a line or after a
 * space. Arrow keys move, Enter or Tab runs, Escape closes; the typed query
 * filters commands.
 */
export function slashPlugin(): Plugin<SlashState> {
  return new Plugin<SlashState>({
    key: slashKey,
    state: {
      init: () => INACTIVE,
      apply: (tr, previous, _old, state) => {
        const meta = tr.getMeta(slashKey) as SlashMeta | undefined;
        if (meta?.type === "move") return { ...previous, index: meta.index };
        if (meta?.type === "dismiss") return { ...INACTIVE, dismissed: previous.from };
        const { selection } = state;
        if (!selection.empty) return { ...INACTIVE, dismissed: previous.dismissed };
        const { $from } = selection;
        if (!$from.parent.isTextblock || $from.parent.type.spec.code) return INACTIVE;
        const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
        const match = /(?:^|\s)\/([\p{L}\p{N} -]{0,24})$/u.exec(before);
        if (!match) return INACTIVE;
        const from = $from.pos - match[1]!.length - 1;
        if (previous.dismissed === from) return { ...INACTIVE, dismissed: from };
        const query = match[1]!;
        if (filterSlashCommands(query).length === 0 && query.length > 0) return { ...INACTIVE, from, query, dismissed: null };
        return { active: true, from, query, index: query === previous.query && previous.active ? previous.index : 0, dismissed: null };
      },
    },
    props: {
      handleKeyDown: (view, event) => {
        const state = slashKey.getState(view.state);
        if (!state?.active) return false;
        const items = filterSlashCommands(state.query);
        if (event.key === "Escape") {
          view.dispatch(view.state.tr.setMeta(slashKey, { type: "dismiss" }));
          return true;
        }
        if (items.length === 0) return false;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const index = (state.index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          view.dispatch(view.state.tr.setMeta(slashKey, { type: "move", index }));
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          runSlashCommand(view, items[Math.min(state.index, items.length - 1)]!);
          return true;
        }
        return false;
      },
    },
  });
}

/** Removes the typed "/query" and runs the command. */
export function runSlashCommand(view: EditorView, command: SlashCommand): void {
  const state = slashKey.getState(view.state);
  if (state) view.dispatch(view.state.tr.delete(state.from, view.state.selection.from).setMeta(slashKey, { type: "dismiss" }));
  command.run(view);
  view.focus();
}

/* ------------------------------------------------------------------ */
/* Find and replace                                                    */
/* ------------------------------------------------------------------ */

export interface FindOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface FindState extends FindOptions {
  matches: Array<{ from: number; to: number }>;
  current: number;
  error: string | null;
}

export const findKey = new PluginKey<FindState>("find");
const MAX_MATCHES = 1000;

export function buildFindPattern(options: FindOptions): RegExp | string {
  if (!options.query) return "";
  const source = options.regex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wrapped = options.wholeWord ? `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])` : source;
  try {
    return new RegExp(wrapped, `gu${options.caseSensitive ? "" : "i"}`);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid pattern";
  }
}

/** Matches of a pattern within textblocks, as document positions. */
export function findMatches(doc: ProseMirrorNode, pattern: RegExp): Array<{ from: number; to: number }> {
  const matches: Array<{ from: number; to: number }> = [];
  doc.descendants((node, position) => {
    if (matches.length >= MAX_MATCHES) return false;
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, "￼");
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) && matches.length < MAX_MATCHES) {
      if (match[0].length === 0) {
        pattern.lastIndex++;
        continue;
      }
      matches.push({ from: position + 1 + match.index, to: position + 1 + match.index + match[0].length });
    }
    return false;
  });
  return matches;
}

function computeFind(doc: ProseMirrorNode, options: FindOptions, current: number): FindState {
  const pattern = buildFindPattern(options);
  if (typeof pattern === "string") return { ...options, matches: [], current: 0, error: pattern || null };
  const matches = findMatches(doc, pattern);
  return { ...options, matches, current: matches.length ? Math.min(current, matches.length - 1) : 0, error: null };
}

type FindMeta = { type: "set"; options: FindOptions } | { type: "current"; index: number } | { type: "clear" };

const EMPTY_FIND: FindState = { query: "", caseSensitive: false, wholeWord: false, regex: false, matches: [], current: 0, error: null };

export function findPlugin(): Plugin<FindState> {
  return new Plugin<FindState>({
    key: findKey,
    state: {
      init: () => EMPTY_FIND,
      apply: (tr, previous, _old, state) => {
        const meta = tr.getMeta(findKey) as FindMeta | undefined;
        if (meta?.type === "clear") return EMPTY_FIND;
        if (meta?.type === "set") return computeFind(state.doc, meta.options, 0);
        if (meta?.type === "current") return { ...previous, current: meta.index };
        if (tr.docChanged && previous.query) return computeFind(state.doc, previous, previous.current);
        return previous;
      },
    },
    props: {
      decorations: (state) => {
        const find = findKey.getState(state);
        if (!find?.matches.length) return null;
        return DecorationSet.create(
          state.doc,
          find.matches.map((match, index) => Decoration.inline(match.from, match.to, { class: index === find.current ? "find-current" : "find-match" })),
        );
      },
    },
  });
}

/** Applies the case of the matched text to a replacement: "WORD", "Word" or "word". */
export function preserveCase(matched: string, replacement: string): string {
  if (matched.length > 1 && matched === matched.toUpperCase() && matched !== matched.toLowerCase()) return replacement.toUpperCase();
  const first = matched.charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  if (matched === matched.toLowerCase() && matched !== matched.toUpperCase()) return replacement.toLowerCase();
  return replacement;
}

function replacementFor(state: FindState, matched: string, replacement: string, keepCase: boolean): string {
  let text = replacement;
  if (state.regex) {
    const pattern = buildFindPattern({ ...state });
    if (pattern instanceof RegExp) text = matched.replace(new RegExp(pattern.source, pattern.flags.replace("g", "")), replacement);
  }
  return keepCase ? preserveCase(matched, text) : text;
}

export function replaceCurrent(view: EditorView, replacement: string, keepCase = false): boolean {
  const state = findKey.getState(view.state);
  const match = state?.matches[state.current];
  if (!state || !match) return false;
  const matched = view.state.doc.textBetween(match.from, match.to);
  const text = replacementFor(state, matched, replacement, keepCase);
  const tr = text ? view.state.tr.insertText(text, match.from, match.to) : view.state.tr.delete(match.from, match.to);
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function replaceAll(view: EditorView, replacement: string, keepCase = false): number {
  const state = findKey.getState(view.state);
  if (!state?.matches.length) return 0;
  const tr = view.state.tr;
  for (const match of [...state.matches].reverse()) {
    const matched = view.state.doc.textBetween(match.from, match.to);
    const text = replacementFor(state, matched, replacement, keepCase);
    if (text) tr.insertText(text, match.from, match.to);
    else tr.delete(match.from, match.to);
  }
  view.dispatch(tr);
  return state.matches.length;
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export const commentKey = new PluginKey<string | null>("comment-active");

/** Ranges of every comment mark, by comment id, in document order. */
export function commentRanges(doc: ProseMirrorNode): Map<string, Array<{ from: number; to: number }>> {
  const ranges = new Map<string, Array<{ from: number; to: number }>>();
  const commentType = doc.type.schema.marks.comment;
  if (!commentType) return ranges;
  doc.descendants((node, position) => {
    if (!node.isInline) return true;
    for (const mark of node.marks) {
      if (mark.type !== commentType) continue;
      const id = mark.attrs.id as string;
      const list = ranges.get(id) ?? [];
      const last = list.at(-1);
      if (last && last.to === position) last.to = position + node.nodeSize;
      else list.push({ from: position, to: position + node.nodeSize });
      ranges.set(id, list);
    }
    return false;
  });
  return ranges;
}

/** Highlights the comment set with `setMeta(commentKey, id)`. */
export function commentHighlightPlugin(): Plugin<string | null> {
  return new Plugin<string | null>({
    key: commentKey,
    state: {
      init: () => null,
      apply: (tr, previous) => {
        const meta = tr.getMeta(commentKey) as string | null | undefined;
        return meta === undefined ? previous : meta;
      },
    },
    props: {
      decorations: (state) => {
        const active = commentKey.getState(state);
        if (!active) return null;
        const ranges = commentRanges(state.doc).get(active) ?? [];
        return DecorationSet.create(
          state.doc,
          ranges.map((range) => Decoration.inline(range.from, range.to, { class: "comment-active" })),
        );
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Task item node view                                                 */
/* ------------------------------------------------------------------ */

/** Renders a checkbox before a task item's content; toggling it updates the node. */
export function taskItemView(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined): NodeView {
  const dom = document.createElement("li");
  dom.dataset.type = "task-item";
  const label = document.createElement("label");
  label.contentEditable = "false";
  label.className = "task-item-check";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(node.attrs.checked);
  checkbox.setAttribute("aria-label", "Done");
  checkbox.disabled = !view.editable;
  checkbox.addEventListener("change", () => {
    const position = getPos();
    if (position === undefined) return;
    const current = view.state.doc.nodeAt(position);
    if (!current) return;
    view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, checked: checkbox.checked }));
  });
  label.append(checkbox);
  const content = document.createElement("div");
  content.className = "task-item-content";
  dom.append(label, content);
  dom.dataset.checked = String(Boolean(node.attrs.checked));
  return {
    dom,
    contentDOM: content,
    update: (next) => {
      if (next.type !== node.type) return false;
      node = next;
      checkbox.checked = Boolean(next.attrs.checked);
      checkbox.disabled = !view.editable;
      dom.dataset.checked = String(Boolean(next.attrs.checked));
      return true;
    },
    ignoreMutation: (mutation) => label.contains(mutation.target),
    stopEvent: (event) => label.contains(event.target as globalThis.Node),
  };
}
