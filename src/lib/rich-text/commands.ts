// packages/ai-ui/src/lib/rich-text/commands.ts
import { baseKeymap, chainCommands, exitCode, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { redo, undo } from "prosemirror-history";
import { InputRule, inputRules, textblockTypeInputRule, undoInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { Fragment, type Mark, type MarkType, type Node as ProseMirrorNode, type NodeType, type Schema } from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { type Command, type EditorState, type Plugin, TextSelection, type Transaction } from "prosemirror-state";
import { goToNextCell } from "prosemirror-tables";

import { emitEditorEvent, RICH_TEXT_EVENTS } from "./events.js";
import { safeImageSrc, safeLinkHref } from "./schema.js";

export type BlockKind = "paragraph" | "heading1" | "heading2" | "heading3" | "heading4" | "heading5" | "heading6" | "blockquote" | "code";
export type ListKind = "bullet" | "ordered" | "task";
export type TextAlign = "left" | "center" | "right" | "justify";

/*
 * Commands read node and mark types from the state's schema, so they work
 * with any schema that keeps the rich text node and mark names, such as
 * htmlSchema.
 */

export function isMarkActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()));
  return state.doc.rangeHasMark(from, to, type);
}

/** The block kind at the cursor, used by the block-type picker. */
export function currentBlock(state: EditorState): BlockKind {
  const { $from } = state.selection;
  const { nodes } = state.schema;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === nodes.blockquote) return "blockquote";
  }
  const parent = $from.parent;
  if (parent.type === nodes.heading) return `heading${parent.attrs.level as number}` as BlockKind;
  if (parent.type === nodes.code_block) return "code";
  return "paragraph";
}

/** The innermost list around the cursor and its depth, if any. */
export function currentList(state: EditorState): { kind: ListKind; depth: number; node: ProseMirrorNode } | null {
  const { $from } = state.selection;
  const { nodes } = state.schema;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === nodes.bullet_list) return { kind: "bullet", depth, node };
    if (node.type === nodes.ordered_list) return { kind: "ordered", depth, node };
    if (node.type === nodes.task_list) return { kind: "task", depth, node };
  }
  return null;
}

export function setBlock(kind: BlockKind): Command {
  return (state, dispatch) => {
    const { nodes } = state.schema;
    if (kind === "blockquote") {
      if (currentBlock(state) === "blockquote") return liftOutOf(nodes.blockquote!)(state, dispatch);
      return wrapIn(nodes.blockquote!)(state, dispatch);
    }
    if (kind === "code") return setBlockType(nodes.code_block!)(state, dispatch);
    if (kind === "paragraph") return setBlockType(nodes.paragraph!)(state, dispatch);
    return setBlockType(nodes.heading!, { level: Number(kind.slice(-1)) })(state, dispatch);
  };
}

function liftOutOf(type: NodeType): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;
    const range = $from.blockRange($to, (node) => node.type === type);
    if (!range) return false;
    if (dispatch) {
      const target = range.depth - 1 >= 0 ? range.depth - 1 : 0;
      dispatch(state.tr.lift(range, target).scrollIntoView());
    }
    return true;
  };
}

function listTypes(schema: Schema, kind: ListKind): { list: NodeType; item: NodeType } {
  const { nodes } = schema;
  if (kind === "task") return { list: nodes.task_list!, item: nodes.task_item! };
  return { list: kind === "bullet" ? nodes.bullet_list! : nodes.ordered_list!, item: nodes.list_item! };
}

/**
 * Toggles a list: lifts out of the same kind, converts a different kind in
 * place (keeping nesting and content), or wraps the selection.
 */
export function toggleList(kind: ListKind): Command {
  return (state, dispatch) => {
    const target = listTypes(state.schema, kind);
    const existing = currentList(state);
    if (existing?.kind === kind) return liftListItem(target.item)(state, dispatch);
    if (existing) {
      if (dispatch) {
        const position = state.selection.$from.before(existing.depth);
        const items: ProseMirrorNode[] = [];
        existing.node.forEach((item) => items.push(target.item.create(kind === "task" ? { checked: false } : null, item.content)));
        const list = target.list.create(kind === "ordered" ? { order: 1 } : null, Fragment.from(items));
        const tr = state.tr.replaceWith(position, position + existing.node.nodeSize, list);
        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(state.selection.from, tr.doc.content.size))));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    return wrapInList(target.list, kind === "task" ? null : undefined)(state, dispatch);
  };
}

export const indentList: Command = (state, dispatch, view) => chainCommands(sinkListItem(state.schema.nodes.list_item!), sinkListItem(state.schema.nodes.task_item!))(state, dispatch, view);
export const outdentList: Command = (state, dispatch, view) => chainCommands(liftListItem(state.schema.nodes.list_item!), liftListItem(state.schema.nodes.task_item!))(state, dispatch, view);

export function setAlign(align: TextAlign | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let changed = false;
    const tr = state.tr;
    const { nodes } = state.schema;
    state.doc.nodesBetween(from, to, (node, position) => {
      if (node.type === nodes.paragraph || node.type === nodes.heading) {
        tr.setNodeMarkup(position, undefined, { ...node.attrs, align: align === "left" ? null : align });
        changed = true;
      }
    });
    if (changed && dispatch) dispatch(tr);
    return changed;
  };
}

export function currentAlign(state: EditorState): TextAlign {
  const parent = state.selection.$from.parent;
  return (parent.attrs.align as TextAlign | null | undefined) ?? "left";
}

/** Adds a link to the selection, or inserts the URL as linked text when nothing is selected. Rejects unsafe URLs. */
export function setLink(href: string, title?: string): Command {
  return (state, dispatch) => {
    const safe = safeLinkHref(href.trim());
    if (!safe) return false;
    const linkType = state.schema.marks.link!;
    const mark = linkType.create({ href: safe, title: title || null });
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const range = linkRange(state);
        if (range) tr.removeMark(range.from, range.to, linkType).addMark(range.from, range.to, mark);
        else tr.insert(from, state.schema.text(href.trim(), [mark]));
      } else {
        tr.removeMark(from, to, linkType).addMark(from, to, mark);
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** The link around the cursor, if any: the run of text sharing one link mark. */
export function linkRange(state: EditorState): { from: number; to: number; href: string } | null {
  const { $from } = state.selection;
  const start = $from.start();
  const runs: Array<{ from: number; to: number; mark: Mark }> = [];
  $from.parent.forEach((child, offset) => {
    const mark = state.schema.marks.link!.isInSet(child.marks);
    if (!mark) return;
    const from = start + offset;
    const last = runs.at(-1);
    if (last && last.to === from && last.mark.eq(mark)) last.to = from + child.nodeSize;
    else runs.push({ from, to: from + child.nodeSize, mark });
  });
  const run = runs.find((item) => $from.pos > item.from && $from.pos < item.to) ?? runs.find((item) => $from.pos >= item.from && $from.pos <= item.to);
  return run ? { from: run.from, to: run.to, href: run.mark.attrs.href as string } : null;
}

export const removeLink: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  const range = empty ? linkRange(state) : { from, to };
  if (!range) return false;
  if (dispatch) dispatch(state.tr.removeMark(range.from, range.to, state.schema.marks.link!));
  return true;
};

export function insertImage(src: string, alt = "", title?: string): Command {
  return (state, dispatch) => {
    const safe = safeImageSrc(src.trim());
    if (!safe) return false;
    if (dispatch) dispatch(state.tr.replaceSelectionWith(state.schema.nodes.image!.create({ src: safe, alt, title: title || null })).scrollIntoView());
    return true;
  };
}

export function insertTable(rows = 3, columns = 3): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const { nodes } = state.schema;
      const cell = (header: boolean) => (header ? nodes.table_header! : nodes.table_cell!).create(null, nodes.paragraph!.create());
      const tableRows = Array.from({ length: rows }, (_, row) => nodes.table_row!.create(null, Array.from({ length: columns }, () => cell(row === 0))));
      const table = nodes.table!.create(null, tableRows);
      const tr = state.tr.replaceSelectionWith(table);
      const inserted = tr.selection.from;
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, inserted - table.nodeSize + 3))));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export const insertHorizontalRule: Command = (state, dispatch) => {
  if (dispatch) {
    const tr = state.tr.replaceSelectionWith(state.schema.nodes.horizontal_rule!.create());
    const after = tr.selection.$from;
    if (!after.nodeAfter || !after.nodeAfter.isTextblock) tr.insert(after.pos, state.schema.nodes.paragraph!.create());
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Removes inline formatting (every mark except links and comments) from the selection. */
export const clearFormatting: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) {
    if (dispatch) dispatch(state.tr.setStoredMarks([]));
    return true;
  }
  if (dispatch) {
    const tr = state.tr;
    for (const type of Object.values(state.schema.marks)) {
      if (type.name !== "link" && type.name !== "comment") tr.removeMark(from, to, type);
    }
    dispatch(tr);
  }
  return true;
};

export const insertHardBreak: Command = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.replaceSelectionWith(state.schema.nodes.hard_break!.create()).scrollIntoView());
  return true;
};

export function toggleTaskAt(position: number, checked: boolean): (tr: Transaction) => Transaction {
  return (tr) => {
    const node = tr.doc.nodeAt(position);
    return node && node.type === tr.doc.type.schema.nodes.task_item ? tr.setNodeMarkup(position, undefined, { ...node.attrs, checked }) : tr;
  };
}

function markInputRule(pattern: RegExp, type: MarkType): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const text = match[2];
    if (!text) return null;
    const prefix = match[1] ?? "";
    const tr = state.tr;
    const textStart = start + prefix.length;
    tr.delete(textStart, end);
    tr.insert(textStart, state.schema.text(text, [type.create(), ...state.selection.$from.marks()]));
    tr.removeStoredMark(type);
    return tr;
  });
}

function buildInputRules(schema: Schema): Plugin {
  return inputRules({
    rules: [
      textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading!, (match) => ({ level: match[1]!.length })),
      wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote!),
      wrappingInputRule(/^\s*\[([ xX]?)\]\s$/, schema.nodes.task_list!),
      wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list!),
      wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list!, (match) => ({ order: Number(match[1]) }), (match, node) => node !== null && node.childCount + (node.attrs.order as number) === Number(match[1])),
      textblockTypeInputRule(/^```([\w+#-]*)\s$/, schema.nodes.code_block!, (match) => ({ language: match[1] ?? "" })),
      new InputRule(/^(?:---|\*\*\*|___)\s$/, (state, _match, start, end) => {
        const $start = state.doc.resolve(start);
        if ($start.parent.type !== schema.nodes.paragraph || $start.parent.textContent.length !== end - start - 1) return null;
        const blockStart = $start.before();
        const tr = state.tr.replaceWith(blockStart, $start.after(), [schema.nodes.horizontal_rule!.create(), schema.nodes.paragraph!.create()]);
        tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + 2)));
        return tr;
      }),
      markInputRule(/(^|[^*\w])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, schema.marks.strong!),
      markInputRule(/(^|[^_\w])__([^_\s](?:[^_]*[^_\s])?)__$/, schema.marks.strong!),
      markInputRule(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/, schema.marks.em!),
      markInputRule(/(^|[^_\w])_([^_\s](?:[^_]*[^_\s])?)_$/, schema.marks.em!),
      markInputRule(/(^|[^`])`([^`]+)`$/, schema.marks.code!),
      markInputRule(/(^|[^~])~~([^~\s](?:[^~]*[^~\s])?)~~$/, schema.marks.strike!),
      markInputRule(/(^|[^=])==([^=\s](?:[^=]*[^=\s])?)==$/, schema.marks.highlight!),
    ],
  });
}

/** Keyboard shortcuts and markdown input rules for the editor. Ctrl+K and Ctrl+F raise RICH_TEXT_EVENTS on the editor root. */
export function buildKeymaps(schema: Schema): Plugin[] {
  const listEnter = chainCommands(splitListItem(schema.nodes.list_item!), splitListItem(schema.nodes.task_item!));
  return [
    buildInputRules(schema),
    keymap({
      "Mod-z": undo,
      "Shift-Mod-z": redo,
      "Mod-y": redo,
      "Mod-b": toggleMark(schema.marks.strong!),
      "Mod-i": toggleMark(schema.marks.em!),
      "Mod-u": toggleMark(schema.marks.underline!),
      "Mod-e": toggleMark(schema.marks.code!),
      "Mod-Shift-x": toggleMark(schema.marks.strike!),
      "Mod-Shift-h": toggleMark(schema.marks.highlight!),
      "Mod-k": (_state, _dispatch, view) => emitEditorEvent(view, RICH_TEXT_EVENTS.openLink),
      "Mod-f": (_state, _dispatch, view) => emitEditorEvent(view, RICH_TEXT_EVENTS.openFind),
      "Mod-Alt-0": setBlock("paragraph"),
      "Mod-Alt-1": setBlock("heading1"),
      "Mod-Alt-2": setBlock("heading2"),
      "Mod-Alt-3": setBlock("heading3"),
      "Mod-Shift-7": toggleList("ordered"),
      "Mod-Shift-8": toggleList("bullet"),
      "Mod-Shift-9": toggleList("task"),
      "Mod-Shift-b": setBlock("blockquote"),
      "Mod-]": indentList,
      "Mod-[": outdentList,
      "Shift-Enter": chainCommands(exitCode, insertHardBreak),
      "Mod-Enter": exitCode,
      Enter: listEnter,
      Tab: chainCommands(goToNextCell(1), indentList),
      "Shift-Tab": chainCommands(goToNextCell(-1), outdentList),
      Backspace: undoInputRule,
    }),
    keymap(baseKeymap),
  ];
}
