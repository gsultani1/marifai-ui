// packages/ai-ui/src/lib/rich-text/html-commands.ts
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { type Command, type EditorState, NodeSelection, type Transaction } from "prosemirror-state";

import { safeImageSrc } from "../safe-url.js";
import { currentList, indentList, outdentList } from "./commands.js";
import { embedFromUrl, MAX_INDENT } from "./html.js";

/** Marks that carry one CSS value, as defined by htmlSchema. */
export type StyleMarkName = "font_family" | "font_size" | "text_color" | "background_color";

/** Sets a style mark on the selection (or the next typed text), replacing any previous value; null removes it. */
export function setStyleMark(name: StyleMarkName, value: string | null): Command {
  return (state, dispatch) => {
    const type = state.schema.marks[name];
    if (!type) return false;
    if (dispatch) {
      const { from, to, empty } = state.selection;
      if (empty) {
        const marks = type.removeFromSet(state.storedMarks ?? state.selection.$from.marks());
        dispatch(state.tr.setStoredMarks(value ? type.create({ value }).addToSet(marks) : marks));
      } else {
        const tr = state.tr.removeMark(from, to, type);
        if (value) tr.addMark(from, to, type.create({ value }));
        dispatch(tr.scrollIntoView());
      }
    }
    return true;
  };
}

/** The style mark value at the cursor or shared by all selected text; null when absent or mixed. */
export function currentStyleMark(state: EditorState, name: StyleMarkName): string | null {
  const type = state.schema.marks[name];
  if (!type) return null;
  const { $from, from, to, empty } = state.selection;
  if (empty) return (type.isInSet(state.storedMarks ?? $from.marks())?.attrs.value as string | undefined) ?? null;
  let found: string | null | undefined;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText || found === null) return;
    const value = (type.isInSet(node.marks)?.attrs.value as string | undefined) ?? null;
    found = found === undefined || found === value ? value : null;
  });
  return found ?? null;
}

/** Indents or outdents: list items nest or lift, other paragraphs and headings move by one indent step. */
export function changeIndent(delta: 1 | -1): Command {
  return (state, dispatch, view) => {
    if (currentList(state)) return (delta > 0 ? indentList : outdentList)(state, dispatch, view);
    const { from, to } = state.selection;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, position) => {
      if (!node.isTextblock || typeof node.attrs.indent !== "number") return;
      const next = Math.max(0, Math.min(MAX_INDENT, (node.attrs.indent as number) + delta));
      if (next !== node.attrs.indent) tr.setNodeMarkup(position, undefined, { ...node.attrs, indent: next });
    });
    if (!tr.docChanged) return false;
    if (dispatch) dispatch(tr);
    return true;
  };
}

/** Whether the cursor block can be outdented. */
export function canOutdent(state: EditorState): boolean {
  return Boolean(currentList(state)) || changeIndent(-1)(state);
}

/** Inserts a YouTube, Vimeo, Loom or video file embed; false for any other link. */
export function insertEmbed(url: string, title = ""): Command {
  return (state, dispatch) => {
    const embed = embedFromUrl(url);
    const type = state.schema.nodes.embed;
    if (!embed || !type) return false;
    if (dispatch) dispatch(insertBlockNode(state, type.create({ ...embed, title })));
    return true;
  };
}

export interface ImageAttrs {
  src: string;
  alt?: string;
  width?: number | null;
}

/** The selected image's or figure's attributes, if one is selected. */
export function selectedImage(state: EditorState): (ImageAttrs & { title: string | null; figure: boolean }) | null {
  const { selection } = state;
  if (!(selection instanceof NodeSelection) || (selection.node.type.name !== "image" && selection.node.type.name !== "figure")) return null;
  const { src, alt, width, title } = selection.node.attrs as { src: string; alt: string; width: number | null; title: string | null };
  return { src, alt, width, title, figure: selection.node.type.name === "figure" };
}

function imageAttrs({ src, alt = "", width = null }: ImageAttrs): { src: string; alt: string; width: number | null } | null {
  const safe = safeImageSrc(src.trim());
  if (!safe) return null;
  return { src: safe, alt, width: width && Number.isFinite(width) && width >= 16 ? Math.min(4000, Math.round(width)) : null };
}

/** Inserts a block node at the cursor and makes sure a paragraph follows it, so typing can continue. */
export function insertBlockNode(state: EditorState, node: ProseMirrorNode): Transaction {
  const tr = state.tr.replaceSelectionWith(node);
  const after = tr.selection.$from;
  if (!after.nodeAfter || !after.nodeAfter.isTextblock) tr.insert(after.pos, state.schema.nodes.paragraph!.create());
  return tr.scrollIntoView();
}

/** Inserts a captioned figure (or an inline image in schemas without figures). Rejects unsafe sources. */
export function insertFigure(image: ImageAttrs & { caption?: string }): Command {
  return (state, dispatch) => {
    const attrs = imageAttrs(image);
    const figure = state.schema.nodes.figure;
    const inline = state.schema.nodes.image;
    if (!attrs || (!figure && !inline)) return false;
    if (dispatch) {
      if (figure) dispatch(insertBlockNode(state, figure.create(attrs, image.caption ? state.schema.text(image.caption) : null)));
      else dispatch(state.tr.replaceSelectionWith(inline!.create({ src: attrs.src, alt: attrs.alt, ...("width" in inline!.spec.attrs! ? { width: attrs.width } : {}) })).scrollIntoView());
    }
    return true;
  };
}

/** Updates the selected image or figure, or inserts a new figure. Rejects unsafe sources. */
export function placeImage(image: ImageAttrs): Command {
  return (state, dispatch, view) => {
    const attrs = imageAttrs(image);
    if (!attrs) return false;
    if (!selectedImage(state)) return insertFigure(image)(state, dispatch, view);
    if (dispatch) {
      const node = (state.selection as NodeSelection).node;
      dispatch(state.tr.setNodeMarkup(state.selection.from, undefined, { ...node.attrs, src: attrs.src, alt: attrs.alt, ...("width" in node.type.spec.attrs! ? { width: attrs.width } : {}) }));
    }
    return true;
  };
}
