// packages/ai-ui/src/lib/rich-text/html-blocks.ts
import { wrapIn } from "prosemirror-commands";
import type { Attrs, Node as ProseMirrorNode, NodeType } from "prosemirror-model";
import { liftListItem } from "prosemirror-schema-list";
import { type Command, EditorState, NodeSelection, Plugin, PluginKey, Selection, TextSelection, type Transaction } from "prosemirror-state";
import { liftTarget, Mapping } from "prosemirror-transform";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

import type { HtmlSlashItem } from "../../components/html-editor-extension.js";
import { currentList, type ListKind, toggleList } from "./commands.js";

/* ------------------------------------------------------------------ */
/* Slash menu filtering                                                */
/* ------------------------------------------------------------------ */

const words = (text: string) => text.toLowerCase().split(/[\s-]+/).filter(Boolean);

/** How well an item matches a lowercase query: 0 is best, -1 is no match. */
function slashScore(item: HtmlSlashItem, needle: string): number {
  const label = item.label.toLowerCase();
  if (label.startsWith(needle)) return 0;
  const tokens = needle.split(" ");
  const labelWords = words(label);
  if (tokens.every((token) => labelWords.some((word) => word.startsWith(token)))) return 1;
  if (label.includes(needle)) return 2;
  const keywords = (item.keywords ?? []).map((keyword) => keyword.toLowerCase());
  if (keywords.some((keyword) => keyword.startsWith(needle))) return 3;
  const keywordWords = keywords.flatMap(words);
  if (tokens.every((token) => labelWords.some((word) => word.startsWith(token)) || keywordWords.some((word) => word.startsWith(token)))) return 4;
  return -1;
}

/**
 * Slash items matching a query by label and keywords, best matches first,
 * then gathered by group in the order the groups first appear, so the flat
 * list is also the order the menu shows them in.
 */
export function filterSlashItems(items: readonly HtmlSlashItem[], query: string): HtmlSlashItem[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
  const ranked = items
    .map((item, order) => ({ item, order, score: needle ? slashScore(item, needle) : 0 }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.order - b.order);
  const groups = new Map<string, HtmlSlashItem[]>();
  for (const { item } of ranked) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups.values()].flat();
}

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

/** The open slash menu: where its "/" is, what follows it and which item is active. */
export interface SlashState {
  from: number;
  query: string;
  index: number;
}

export interface BlocksPluginState {
  slash: SlashState | null;
  /** Whether the editor has focus, for the empty line hint. */
  focused: boolean;
  /** Start of the top-level block being dragged. */
  dragging: number | null;
}

/** Transaction meta for the blocks plugin. */
export type BlocksMeta = { type: "open"; from: number } | { type: "close" } | { type: "index"; index: number } | { type: "focus"; focused: boolean } | { type: "drag"; pos: number | null };

export const blocksKey = new PluginKey<BlocksPluginState>("ai-ui-html-blocks");

export interface BlocksPluginOptions {
  /** Slash menu on: prop on, not compact, editable. */
  slashMenu: () => boolean;
  /** Block handles and their shortcuts on. */
  blockHandles: () => boolean;
  /** Selection toolbar on. */
  bubbleToolbar: () => boolean;
  /** Every extension's slash items. */
  items: () => readonly HtmlSlashItem[];
  /** Id of the slash listbox; options are `${id}-${index}`. */
  listboxId: string;
  /** Opens the block menu for the top-level block at `pos` (Ctrl+/). */
  openBlockMenu: (pos: number) => boolean;
  /** Moves focus into the selection toolbar (Alt+F10). */
  focusBubble: () => boolean;
  announce: (message: string) => void;
  /** Shown in an empty top-level paragraph holding the cursor. */
  hint?: string;
}

const QUERY = /^(?:[\p{L}\p{N}][\p{L}\p{N} -]{0,31})?$/u;
const SLASH_PARENTS = new Set(["paragraph", "heading"]);

/** Text of a textblock between two offsets, skipping text marked as a tracked deletion; inline nodes count as one character. */
function liveText(parent: ProseMirrorNode, from: number, to: number): string {
  const deletion = parent.type.schema.marks.deletion;
  let text = "";
  parent.nodesBetween(from, to, (node, pos) => {
    if (node.isText) {
      if (!deletion?.isInSet(node.marks)) text += node.text!.slice(Math.max(0, from - pos), Math.max(0, to - pos));
    } else if (node.isInline) {
      text += "￼";
    }
    return false;
  });
  return text;
}

/** The slash range at the cursor if the menu should stay open, else null. */
function validSlash(state: EditorState, from: number, previous: SlashState | null): SlashState | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;
  const $cursor = selection.$from;
  const start = $cursor.start();
  if (!SLASH_PARENTS.has($cursor.parent.type.name) || from < start || from >= $cursor.pos) return null;
  const text = liveText($cursor.parent, from - start, $cursor.parentOffset);
  if (!text.startsWith("/")) return null;
  const query = text.slice(1);
  if (!QUERY.test(query)) return null;
  return { from, query, index: previous && previous.query === query ? previous.index : 0 };
}

/** Whether this transaction typed a "/" at the start of a paragraph or heading, or after a space. */
function typedSlash(tr: Transaction, old: EditorState, state: EditorState): number | null {
  const { selection } = state;
  if (!tr.docChanged || !selection.empty || tr.getMeta("uiEvent") || !(selection instanceof TextSelection)) return null;
  const $cursor = selection.$from;
  if (!SLASH_PARENTS.has($cursor.parent.type.name)) return null;
  const before = liveText($cursor.parent, 0, $cursor.parentOffset);
  if (!before.endsWith("/") || (before.length > 1 && !/\s/.test(before.charAt(before.length - 2)))) return null;
  const $old = old.selection.$from;
  if (!$old.parent.inlineContent || tr.mapping.map(old.selection.from, -1) + 1 !== selection.from) return null;
  return liveText($old.parent, 0, $old.parentOffset) + "/" === before ? selection.from - 1 : null;
}

/** Items that match the open slash query, or null when the menu is closed or nothing matches. */
export function slashMatches(state: EditorState, items: readonly HtmlSlashItem[]): { slash: SlashState; matches: HtmlSlashItem[] } | null {
  const slash = blocksKey.getState(state)?.slash;
  if (!slash) return null;
  const matches = filterSlashItems(items, slash.query);
  return matches.length ? { slash, matches } : null;
}

/** Removes the typed "/query", closes the menu and runs the item. */
export function runSlashItem(view: EditorView, item: HtmlSlashItem): void {
  const slash = blocksKey.getState(view.state)?.slash;
  const tr = view.state.tr.setMeta(blocksKey, { type: "close" } satisfies BlocksMeta);
  if (slash) tr.delete(slash.from, Math.max(slash.from, view.state.selection.from));
  view.dispatch(tr);
  item.run(view);
  view.focus();
}

/** The top-level block holding a position: its start, node and index in the document. */
export function topLevelBlock(doc: ProseMirrorNode, pos: number): { pos: number; node: ProseMirrorNode; index: number } | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  if ($pos.depth === 0) {
    const node = $pos.nodeAfter ?? $pos.nodeBefore;
    if (!node) return null;
    const index = $pos.nodeAfter ? $pos.index(0) : $pos.index(0) - 1;
    return { pos: $pos.nodeAfter ? $pos.pos : $pos.pos - node.nodeSize, node, index };
  }
  return { pos: $pos.before(1), node: $pos.node(1), index: $pos.index(0) };
}

/**
 * Records focus changes in the plugin state after the event, so the
 * dispatch never runs inside ProseMirror's own update; blurring closes the
 * slash menu.
 */
function syncFocus(view: EditorView): void {
  queueMicrotask(() => {
    if (view.isDestroyed) return;
    const focused = view.hasFocus();
    if (blocksKey.getState(view.state)?.focused === focused) return;
    view.dispatch(view.state.tr.setMeta(blocksKey, { type: "focus", focused } satisfies BlocksMeta).setMeta("addToHistory", false));
  });
}

/**
 * The slash menu (filtered by what follows a typed "/", with Arrow keys,
 * Enter, Tab and Escape), the empty line hint, the dragged block's look,
 * and the block shortcuts: Ctrl+/ opens the block menu, Alt+Shift+Arrow
 * keys move the block and Alt+F10 focuses the selection toolbar. Options
 * are read on every transaction, so props can change at any time.
 */
export function blocksPlugin(options: BlocksPluginOptions): Plugin<BlocksPluginState> {
  const move = (view: EditorView, direction: -1 | 1) => {
    const moved = moveCurrentBlock(direction)(view.state, view.dispatch);
    if (moved) options.announce(`Moved ${moved === "item" ? "list item" : "block"} ${direction < 0 ? "up" : "down"}`);
    else options.announce(direction < 0 ? "Already at the top" : "Already at the bottom");
    view.focus();
    return true;
  };
  return new Plugin<BlocksPluginState>({
    key: blocksKey,
    state: {
      init: () => ({ slash: null, focused: false, dragging: null }),
      apply: (tr, previous, old, state) => {
        const meta = tr.getMeta(blocksKey) as BlocksMeta | undefined;
        const focused = meta?.type === "focus" ? meta.focused : previous.focused;
        const dragging = meta?.type === "drag" ? meta.pos : previous.dragging === null ? null : tr.mapping.map(previous.dragging);
        let slash: SlashState | null = null;
        if (meta?.type === "close" || !options.slashMenu() || (meta?.type === "focus" && !meta.focused)) slash = null;
        else if (meta?.type === "open") slash = validSlash(state, meta.from, null);
        else if (meta?.type === "index" && previous.slash) slash = { ...previous.slash, index: meta.index };
        else if (previous.slash) slash = validSlash(state, tr.mapping.map(previous.slash.from, 1), previous.slash);
        else {
          const from = typedSlash(tr, old, state);
          slash = from === null ? null : validSlash(state, from, null);
        }
        if (slash && slash.query.endsWith(" ") && filterSlashItems(options.items(), slash.query).length === 0) slash = null;
        return { slash, focused, dragging };
      },
    },
    props: {
      handleKeyDown: (view, event) => {
        if (event.isComposing) return false;
        const open = slashMatches(view.state, options.items());
        const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
        if (open && plain) {
          const { slash, matches } = open;
          const index = Math.min(slash.index, matches.length - 1);
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !event.shiftKey) {
            const next = (index + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
            view.dispatch(view.state.tr.setMeta(blocksKey, { type: "index", index: next } satisfies BlocksMeta));
            return true;
          }
          if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
            runSlashItem(view, matches[index]!);
            return true;
          }
          if (event.key === "Escape") {
            view.dispatch(view.state.tr.setMeta(blocksKey, { type: "close" } satisfies BlocksMeta));
            return true;
          }
        }
        if (!view.editable) return false;
        const mod = event.ctrlKey || event.metaKey;
        if (mod && !event.altKey && event.key === "/" && options.blockHandles()) {
          const block = topLevelBlock(view.state.doc, view.state.selection.from);
          return block ? options.openBlockMenu(block.pos) : false;
        }
        if (event.altKey && event.shiftKey && !mod && (event.key === "ArrowUp" || event.key === "ArrowDown") && options.blockHandles()) return move(view, event.key === "ArrowUp" ? -1 : 1);
        if (event.altKey && !mod && event.key === "F10" && options.bubbleToolbar()) return options.focusBubble();
        return false;
      },
      handleDOMEvents: {
        focus: (view) => {
          syncFocus(view);
          return false;
        },
        blur: (view) => {
          syncFocus(view);
          return false;
        },
      },
      attributes: (state): Record<string, string> => {
        const open = options.slashMenu() ? slashMatches(state, options.items()) : null;
        if (!open) return {};
        return { "aria-controls": options.listboxId, "aria-activedescendant": `${options.listboxId}-${Math.min(open.slash.index, open.matches.length - 1)}`, "aria-autocomplete": "list" };
      },
      decorations: (state) => {
        const plugin = blocksKey.getState(state);
        if (!plugin) return null;
        const decorations: Decoration[] = [];
        if (plugin.slash && options.slashMenu()) decorations.push(Decoration.inline(plugin.slash.from, state.selection.from, { class: "rounded-sm bg-accent" }));
        if (plugin.dragging !== null) {
          const node = state.doc.nodeAt(plugin.dragging);
          if (node) decorations.push(Decoration.node(plugin.dragging, plugin.dragging + node.nodeSize, { class: "opacity-40" }));
        }
        const { $from, empty } = state.selection;
        const lone = state.doc.childCount === 1;
        if (options.hint && plugin.focused && empty && !plugin.slash && options.slashMenu() && !lone && $from.depth === 1 && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0) {
          decorations.push(Decoration.node($from.before(), $from.after(), { class: "is-empty", "data-placeholder": options.hint }));
        }
        return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Command chaining                                                    */
/* ------------------------------------------------------------------ */

/** Runs commands one after another into a single transaction, so the whole conversion is one undo step. */
function chain(start: EditorState) {
  const tr = start.tr;
  let state = start;
  return {
    tr,
    get state() {
      return state;
    },
    run(command: Command): boolean {
      return command(state, (inner) => {
        for (const step of inner.steps) tr.step(step);
        tr.setSelection(inner.selection.map(tr.doc, new Mapping()));
        state = EditorState.create({ schema: start.schema, doc: tr.doc, selection: tr.selection });
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Turn into                                                           */
/* ------------------------------------------------------------------ */

/** Block kinds the turn-into commands convert between. */
export type TurnIntoKind = "paragraph" | "heading1" | "heading2" | "heading3" | "code" | "quote" | ListKind;

const CONVERTIBLE = new Set(["paragraph", "heading", "code_block"]);
const LIST_KINDS: Record<string, ListKind> = { bullet_list: "bullet", ordered_list: "ordered", task_list: "task" };

function textblockKind(node: ProseMirrorNode): TurnIntoKind | null {
  if (node.type.name === "paragraph") return "paragraph";
  if (node.type.name === "code_block") return "code";
  if (node.type.name === "heading" && (node.attrs.level as number) <= 3) return `heading${node.attrs.level as 1 | 2 | 3}`;
  return null;
}

/** The kind of the block at the cursor: its innermost list or quote, else its paragraph, heading or code block. */
export function currentTurnInto(state: EditorState): TurnIntoKind | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const list = LIST_KINDS[node.type.name];
    if (list) return list;
    if (node.type.name === "blockquote") return "quote";
    if (node.type.spec.isolating || node.type.name === "callout") break;
  }
  return textblockKind($from.parent);
}

/** The kind of a top-level block, for marking it in a turn-into menu. */
export function blockTurnInto(node: ProseMirrorNode): TurnIntoKind | null {
  if (node.type.name === "blockquote") return "quote";
  return LIST_KINDS[node.type.name] ?? textblockKind(node);
}

/** Converts every paragraph, heading and code block in the selection to `type`, keeping alignment and indent where both allow them. */
function setTextblocks(type: NodeType, attrs: Attrs | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    const targets: number[] = [];
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock) return true;
      const same = node.type === type && Object.entries(attrs ?? {}).every(([key, value]) => node.attrs[key] === value);
      if (CONVERTIBLE.has(node.type.name) && !same) targets.push(pos);
      return false;
    });
    if (!targets.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const pos of targets.reverse()) {
        tr.setBlockType(pos + 1, pos + 1, type, (old) => {
          const kept: Record<string, unknown> = {};
          for (const key of ["align", "indent"]) if (type.spec.attrs?.[key] && old.attrs[key] !== undefined) kept[key] = old.attrs[key];
          return { ...kept, ...attrs };
        });
      }
      dispatch(tr);
    }
    return true;
  };
}

/** Lifts the selection out of every list around it. */
const liftLists: Command = (state, dispatch) => {
  if (!currentList(state)) return false;
  const run = chain(state);
  const { list_item: item, task_item: task } = state.schema.nodes;
  for (let pass = 0; pass < 8 && currentList(run.state); pass++) {
    if (!((item && run.run(liftListItem(item))) || (task && run.run(liftListItem(task))))) break;
  }
  if (!run.tr.docChanged) return false;
  dispatch?.(run.tr);
  return true;
};

/** Lifts the selected blocks out of the nearest quote. */
const liftFromQuote: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  const range = $from.blockRange($to, (node) => node.type.name === "blockquote");
  const target = range ? liftTarget(range) : null;
  if (!range || target === null) return false;
  dispatch?.(state.tr.lift(range, target));
  return true;
};

/**
 * Turns the block at the cursor (or every block in the selection) into
 * another kind: lists and quotes are unwrapped before becoming text,
 * headings or code, headings become paragraphs before joining a list, and
 * a list changes kind in place. Already being that kind is a no-op.
 */
export function turnInto(kind: TurnIntoKind): Command {
  return (state, dispatch) => {
    if (currentTurnInto(state) === kind) return true;
    const { nodes } = state.schema;
    const run = chain(state);
    if (kind === "bullet" || kind === "ordered" || kind === "task") {
      if (currentList(state)) return toggleList(kind)(state, dispatch);
      run.run(setTextblocks(nodes.paragraph!, null));
      if (!run.run(toggleList(kind))) return false;
    } else if (kind === "quote") {
      run.run(liftLists);
      if (!nodes.blockquote || !run.run(wrapIn(nodes.blockquote))) return false;
    } else {
      run.run(liftLists);
      run.run(liftFromQuote);
      const target = kind === "paragraph" ? nodes.paragraph : kind === "code" ? nodes.code_block : nodes.heading;
      if (target) run.run(setTextblocks(target, kind === "code" ? { language: "" } : kind === "paragraph" ? null : { level: Number(kind.slice(-1)) }));
      if (!run.tr.docChanged) return false;
    }
    dispatch?.(run.tr.scrollIntoView());
    return true;
  };
}

/* ------------------------------------------------------------------ */
/* Inserting blocks                                                    */
/* ------------------------------------------------------------------ */

/**
 * Inserts block nodes at the cursor: an empty paragraph holding the cursor
 * is replaced, at the start or end of a textblock they go before or after
 * it, and in the middle the textblock is split around them. A paragraph
 * follows when nothing typeable does, and the cursor lands in the first
 * text position inside the first node, or after the nodes.
 */
export function insertBlocks(nodes: ProseMirrorNode[], cursor: "inside" | "after" = "after"): Command {
  return (state, dispatch) => {
    if (!nodes.length || !(state.selection instanceof TextSelection)) return false;
    if (dispatch) {
      const paragraph = state.schema.nodes.paragraph!;
      const tr = state.tr;
      if (!state.selection.empty) tr.deleteSelection();
      const $from = tr.selection.$from;
      let start: number;
      if ($from.parent.type === paragraph && $from.parent.content.size === 0) {
        start = $from.before();
        tr.replaceWith(start, $from.after(), nodes);
      } else {
        if ($from.parentOffset === $from.parent.content.size) start = $from.after();
        else if ($from.parentOffset === 0) start = $from.before();
        else {
          tr.split($from.pos);
          start = $from.pos + 1;
        }
        tr.insert(start, nodes);
      }
      const end = start + nodes.reduce((size, node) => size + node.nodeSize, 0);
      if (!tr.doc.resolve(end).nodeAfter?.isTextblock) tr.insert(end, paragraph.create());
      const inside = cursor === "inside" ? Selection.findFrom(tr.doc.resolve(start), 1, true) : null;
      tr.setSelection(inside && inside.from < end ? inside : Selection.near(tr.doc.resolve(Math.min(end + 1, tr.doc.content.size))));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Inserts a horizontal rule, replacing the empty paragraph at the cursor. */
export const insertDivider: Command = (state, dispatch, view) => insertBlocks([state.schema.nodes.horizontal_rule!.create()])(state, dispatch, view);

/** Inserts a table with a header row and puts the cursor in its first cell. */
export function insertTableBlock(rows = 3, columns = 3): Command {
  return (state, dispatch, view) => {
    const { nodes } = state.schema;
    const cell = (header: boolean) => (header ? nodes.table_header! : nodes.table_cell!).create(null, nodes.paragraph!.create());
    const table = nodes.table!.create(
      null,
      Array.from({ length: rows }, (_, row) => nodes.table_row!.create(null, Array.from({ length: columns }, () => cell(row === 0)))),
    );
    return insertBlocks([table], "inside")(state, dispatch, view);
  };
}

/**
 * Adds a paragraph holding "/" below (or above) the top-level block at
 * `pos` and opens the slash menu in it. An empty paragraph block is used
 * as it is.
 */
export function insertSlashParagraph(pos: number, side: "below" | "above" = "below"): Command {
  return (state, dispatch) => {
    const block = topLevelBlock(state.doc, pos);
    const paragraph = state.schema.nodes.paragraph!;
    if (!block) return false;
    if (dispatch) {
      const tr = state.tr;
      let slash: number;
      if (block.node.type === paragraph && block.node.content.size === 0) {
        slash = block.pos + 1;
        tr.insertText("/", slash);
      } else {
        const at = side === "below" ? block.pos + block.node.nodeSize : block.pos;
        tr.insert(at, paragraph.create(null, state.schema.text("/")));
        slash = at + 1;
      }
      tr.setSelection(TextSelection.create(tr.doc, slash + 1)).setMeta(blocksKey, { type: "open", from: slash } satisfies BlocksMeta);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/* ------------------------------------------------------------------ */
/* Moving, duplicating and deleting blocks                             */
/* ------------------------------------------------------------------ */

/**
 * Moves child `index` of the node whose content starts at `contentStart`
 * to the gap before child `gap` (0 to childCount), as one replace step.
 * A selection inside the moved node moves with it.
 */
function reorder(state: EditorState, parent: ProseMirrorNode, contentStart: number, index: number, gap: number): Transaction | null {
  if (gap === index || gap === index + 1 || gap < 0 || gap > parent.childCount || index < 0 || index >= parent.childCount) return null;
  const children: ProseMirrorNode[] = [];
  parent.forEach((child) => children.push(child));
  const offset = (at: number) => contentStart + children.slice(0, at).reduce((size, child) => size + child.nodeSize, 0);
  const low = Math.min(index, gap);
  const high = Math.max(index + 1, gap);
  const moving = children[index]!;
  const others = children.slice(low, high).filter((_, position) => low + position !== index);
  const rangeFrom = offset(low);
  const rangeTo = offset(high);
  const movingFrom = offset(index);
  const movingTo = movingFrom + moving.nodeSize;
  const target = gap < index ? rangeFrom : rangeTo - moving.nodeSize;
  const tr = state.tr.replaceWith(rangeFrom, rangeTo, gap < index ? [moving, ...others] : [...others, moving]);
  const remap = (pos: number) => {
    if (pos > movingFrom && pos < movingTo) return pos - movingFrom + target;
    if (pos > rangeFrom && pos < rangeTo) return pos + (gap < index ? moving.nodeSize : -moving.nodeSize);
    return pos;
  };
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.from === movingFrom) tr.setSelection(NodeSelection.create(tr.doc, target));
  else if (selection instanceof TextSelection) tr.setSelection(TextSelection.create(tr.doc, remap(selection.anchor), remap(selection.head)));
  else if (selection instanceof NodeSelection) tr.setSelection(Selection.near(tr.doc.resolve(remap(selection.from))));
  return tr.scrollIntoView();
}

/** Moves the top-level block at `pos` to the gap before top-level block `gap` (0 to childCount); for dragging. */
export function moveBlockTo(pos: number, gap: number): Command {
  return (state, dispatch) => {
    const block = topLevelBlock(state.doc, pos);
    const tr = block ? reorder(state, state.doc, 0, block.index, gap) : null;
    if (!tr) return false;
    dispatch?.(tr);
    return true;
  };
}

/** Moves the top-level block at `pos` one place up or down. */
export function moveBlock(pos: number, direction: -1 | 1): Command {
  return (state, dispatch, view) => {
    const block = topLevelBlock(state.doc, pos);
    return block ? moveBlockTo(block.pos, direction < 0 ? block.index - 1 : block.index + 2)(state, dispatch, view) : false;
  };
}

/**
 * Moves the block at the cursor up or down: a list item among its
 * siblings, anything else as its top-level block. Returns "item" or
 * "block" for what moved (truthy, so it composes as a command) or false
 * at the edge.
 */
export function moveCurrentBlock(direction: -1 | 1): (state: EditorState, dispatch?: (tr: Transaction) => void) => "item" | "block" | false {
  return (state, dispatch) => {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 1; depth--) {
      const name = $from.node(depth).type.name;
      if (name !== "list_item" && name !== "task_item") continue;
      const index = $from.index(depth - 1);
      const tr = reorder(state, $from.node(depth - 1), $from.start(depth - 1), index, direction < 0 ? index - 1 : index + 2);
      if (!tr) return false;
      dispatch?.(tr);
      return "item";
    }
    return moveBlock(state.selection.from, direction)(state, dispatch) ? "block" : false;
  };
}

/** Inserts a copy of the top-level block at `pos` after it and moves a selection inside it to the copy. Comment anchors stay on the original. */
export function duplicateBlock(pos: number): Command {
  return (state, dispatch) => {
    const block = topLevelBlock(state.doc, pos);
    if (!block) return false;
    if (dispatch) {
      const end = block.pos + block.node.nodeSize;
      const tr = state.tr.insert(end, block.node);
      const comment = state.schema.marks.comment;
      if (comment) tr.removeMark(end, end + block.node.nodeSize, comment);
      const { selection } = state;
      if (selection instanceof TextSelection && selection.from > block.pos && selection.to < end) tr.setSelection(TextSelection.create(tr.doc, selection.anchor + block.node.nodeSize, selection.head + block.node.nodeSize));
      else tr.setSelection(Selection.near(tr.doc.resolve(end + 1)));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Deletes the top-level block at `pos`; the last block left becomes an empty paragraph. */
export function deleteBlock(pos: number): Command {
  return (state, dispatch) => {
    const block = topLevelBlock(state.doc, pos);
    if (!block) return false;
    if (dispatch) {
      const end = block.pos + block.node.nodeSize;
      const tr = state.doc.childCount === 1 ? state.tr.replaceWith(0, end, state.schema.nodes.paragraph!.create()) : state.tr.delete(block.pos, end);
      tr.setSelection(Selection.near(tr.doc.resolve(Math.min(block.pos, tr.doc.content.size)), block.pos >= tr.doc.content.size ? -1 : 1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Selects the text inside the top-level block at `pos`, so selection-based commands apply to all of it. */
export function selectBlockContent(pos: number): Command {
  return (state, dispatch) => {
    const block = topLevelBlock(state.doc, pos);
    if (!block) return false;
    const end = block.pos + block.node.nodeSize;
    const first = Selection.findFrom(state.doc.resolve(block.pos), 1, true);
    const last = Selection.findFrom(state.doc.resolve(end), -1, true);
    if (!first || !last || first.from >= end || last.to <= block.pos) return false;
    dispatch?.(state.tr.setSelection(TextSelection.between(first.$from, last.$to)));
    return true;
  };
}
