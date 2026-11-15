// packages/ai-ui/src/lib/rich-text/html-review.ts
import { isHistoryTransaction } from "prosemirror-history";
import { type Attrs, Fragment, type Mark, type MarkType, type Node as ProseMirrorNode, type NodeType, type Schema, Slice } from "prosemirror-model";
import { AllSelection, type Command, type EditorState, Plugin, PluginKey, type Selection, TextSelection, type Transaction } from "prosemirror-state";
import { AddMarkStep, Mapping, RemoveMarkStep, ReplaceStep, type Step, Transform } from "prosemirror-transform";
import { Decoration, DecorationSet } from "prosemirror-view";

import { docToHtml, htmlToDoc, safeAuthor, safeMarkId, safeTimestamp } from "./html.js";
import { commentRanges } from "./plugins.js";

/*
 * Comments and tracked changes for htmlSchema. Changes are `insertion` and
 * `deletion` marks: the track changes plugin turns text edits into them,
 * and accepting or rejecting a change removes either the mark or the text.
 * Block-level edits (block types, list wrapping, tables, block nodes) have
 * no mark to carry them, so they apply normally.
 */

/** A span of the document. */
export interface DocRange {
  from: number;
  to: number;
}

export type ChangeKind = "insertion" | "deletion";

/** One tracked change: every range carrying the same insertion or deletion id, in document order. */
export interface TrackedChange {
  id: string;
  kind: ChangeKind;
  author: string;
  /** ISO timestamp, or "" when unknown. */
  date: string;
  /** The changed text, with block breaks as spaces and images by their description. */
  text: string;
  /** Start of the first range and end of the last. */
  from: number;
  to: number;
  ranges: DocRange[];
}

export type ChangeAction = "accept" | "reject";

interface ChangeTypes {
  insertion: MarkType;
  deletion: MarkType;
}

function changeTypes(schema: Schema): ChangeTypes | null {
  const { insertion, deletion } = schema.marks;
  return insertion && deletion ? { insertion, deletion } : null;
}

function leafText(node: ProseMirrorNode): string {
  if (node.type.name === "image") return `[${(node.attrs.alt as string) || "image"}]`;
  return node.type.name === "hard_break" ? " " : "";
}

/** Every tracked change in the document, ordered by where it starts. */
export function listChanges(doc: ProseMirrorNode): TrackedChange[] {
  const groups = new Map<string, TrackedChange>();
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    const end = pos + node.nodeSize;
    for (const mark of node.marks) {
      const kind = mark.type.name;
      if (kind !== "insertion" && kind !== "deletion") continue;
      const id = mark.attrs.id as string;
      const key = `${kind}:${id}`;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, { id, kind, author: (mark.attrs.author as string) ?? "", date: (mark.attrs.date as string) ?? "", text: "", from: pos, to: end, ranges: [{ from: pos, to: end }] });
        continue;
      }
      const last = group.ranges.at(-1)!;
      if (last.to === pos) last.to = end;
      else group.ranges.push({ from: pos, to: end });
      group.to = end;
    }
    return false;
  });
  const changes = [...groups.values()];
  for (const change of changes) {
    change.text = change.ranges
      .map((range) => doc.textBetween(range.from, range.to, " ", leafText))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return changes;
}

/** Changes that overlap a range; an empty range finds the changes it sits inside. */
export function changesInRange(changes: TrackedChange[], from: number, to: number): TrackedChange[] {
  return changes.filter((change) => change.ranges.some((range) => (from === to ? range.from < from && from < range.to : range.from < to && from < range.to)));
}

/**
 * Joins ranges of one change that only a block boundary separates, such as
 * the halves of a paragraph-spanning paste, so removing the text also
 * removes the break between them.
 */
function mergeAcrossBlocks(doc: ProseMirrorNode, ranges: DocRange[]): DocRange[] {
  const merged: DocRange[] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last) {
      const $end = doc.resolve(last.to);
      const $start = doc.resolve(range.from);
      if ($end.depth > 0 && $end.depth === $start.depth && $end.pos === $end.end() && $start.pos === $start.start() && $end.node(-1) === $start.node(-1) && $start.index(-1) === $end.index(-1) + 1) {
        last.to = range.to;
        continue;
      }
    }
    merged.push({ ...range });
  }
  return merged;
}

/** Deletes text, and the whole block when the text was all it held and its parent keeps other blocks. */
function deleteText(tr: Transform, from: number, to: number): void {
  const $from = tr.doc.resolve(from);
  const $to = tr.doc.resolve(to);
  if ($from.depth > 0 && $from.sameParent($to) && $from.parent.isTextblock && from === $from.start() && to === $from.end()) {
    const parent = $from.node(-1);
    const index = $from.index(-1);
    if (parent.childCount > 1 && parent.canReplace(index, index + 1)) {
      tr.delete($from.before(), $from.after());
      return;
    }
  }
  tr.delete(from, to);
}

/**
 * Accepts or rejects tracked changes on a transform: the ones with the given
 * ids, or every change. Accepting an insertion or rejecting a deletion
 * removes the mark; accepting a deletion or rejecting an insertion removes
 * the text. Returns how many changes it resolved.
 */
export function resolveChanges(tr: Transform, action: ChangeAction, ids?: readonly string[]): number {
  const types = changeTypes(tr.doc.type.schema);
  if (!types) return 0;
  const wanted = ids ? new Set(ids) : null;
  const changes = listChanges(tr.doc).filter((change) => !wanted || wanted.has(change.id));
  const removals: DocRange[] = [];
  for (const change of changes) {
    const dropText = (change.kind === "insertion") === (action === "reject");
    if (dropText) removals.push(...mergeAcrossBlocks(tr.doc, change.ranges));
    else for (const range of change.ranges) tr.removeMark(range.from, range.to, types[change.kind]);
  }
  const base = tr.steps.length;
  for (const range of removals.sort((a, b) => b.from - a.from)) {
    const mapping = tr.mapping.slice(base);
    const from = mapping.map(range.from, 1);
    const to = mapping.map(range.to, -1);
    if (from < to) deleteText(tr, from, to);
  }
  return changes.length;
}

/** Transaction meta the track changes plugin reads; any transaction carrying it is left alone. */
export const trackChangesKey = new PluginKey("ai-ui-track-changes");

function changeCommand(action: ChangeAction, ids?: readonly string[]): Command {
  return (state, dispatch) => {
    const tr = state.tr;
    if (!resolveChanges(tr, action, ids)) return false;
    dispatch?.(tr.setMeta(trackChangesKey, action));
    return true;
  };
}

/** Accepts the change with this id: an insertion keeps its text, a deletion removes it. */
export function acceptChange(id: string): Command {
  return changeCommand("accept", [id]);
}

/** Rejects the change with this id: an insertion removes its text, a deletion keeps it. */
export function rejectChange(id: string): Command {
  return changeCommand("reject", [id]);
}

/** Accepts the changes with these ids, or every change. */
export function acceptChanges(ids?: readonly string[]): Command {
  return changeCommand("accept", ids);
}

/** Rejects the changes with these ids, or every change. */
export function rejectChanges(ids?: readonly string[]): Command {
  return changeCommand("reject", ids);
}

function resolveHtml(html: string, action: ChangeAction): string {
  const tr = new Transform(htmlToDoc(html));
  resolveChanges(tr, action);
  return docToHtml(tr.doc);
}

/** HTML with every tracked change accepted. Needs a DOM, like htmlToDoc and docToHtml. */
export function acceptAllChanges(html: string): string {
  return resolveHtml(html, "accept");
}

/** HTML with every tracked change rejected. Needs a DOM, like htmlToDoc and docToHtml. */
export function rejectAllChanges(html: string): string {
  return resolveHtml(html, "reject");
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

/** Anchors comment `id` on a range, by default the selected text. */
export function addComment(id: string, range?: DocRange): Command {
  return (state, dispatch) => {
    const type = state.schema.marks.comment;
    const { from, to } = range ?? state.selection;
    if (!type || from >= to || to > state.doc.content.size || !safeMarkId(id)) return false;
    dispatch?.(state.tr.addMark(from, to, type.create({ id })));
    return true;
  };
}

/** Removes every mark of comment `id`, leaving the text. */
export function removeComment(id: string): Command {
  return (state, dispatch) => {
    const type = state.schema.marks.comment;
    const ranges = commentRanges(state.doc).get(id);
    if (!type || !ranges?.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const range of ranges) tr.removeMark(range.from, range.to, type.create({ id }));
      dispatch(tr);
    }
    return true;
  };
}

/** The first of `ids` whose text the selection is in or touches. */
export function commentAtSelection(ranges: Map<string, DocRange[]>, ids: ReadonlySet<string>, selection: Selection): string | null {
  const { from, to } = selection;
  for (const [id, list] of ranges) {
    if (!ids.has(id)) continue;
    if (list.some((range) => (from === to ? range.from <= from && from <= range.to : range.from < to && from < range.to))) return id;
  }
  return null;
}

/** A fresh id for a comment, reply or change, valid for safeMarkId. */
export function newMarkId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Track changes plugin                                                */
/* ------------------------------------------------------------------ */

/**
 * "off" leaves every transaction alone; "idle" applies edits normally,
 * except that typed text never picks up a change mark and deleting only
 * text that is already marked deleted moves the caret past it instead, so
 * deleted text changes only through accept and reject; "track" records
 * edits as suggestions.
 */
export type TrackChangesMode = "off" | "idle" | "track";

export interface TrackChangesOptions {
  /** Read on every transaction. */
  mode: (state: EditorState) => TrackChangesMode;
  /** Name stored on new changes; your pending insertions are the ones with this name. */
  author: () => string;
  /** Other transactions to leave alone, such as content applied from props. Undo, redo, appended transactions and accept or reject are always left alone. */
  skip?: (tr: Transaction) => boolean;
  /** Clock for change dates. */
  now?: () => Date;
  /** New change ids. */
  createId?: (prefix: string) => string;
}

interface PendingInsertion extends DocRange {
  typed: boolean;
}

interface PendingDeletion {
  at: number;
  slice: Slice;
  parent: NodeType;
  backward: boolean;
}

function hasInline(fragment: Fragment): boolean {
  let found = false;
  fragment.descendants((node) => {
    if (node.isInline) found = true;
    return !found;
  });
  return found;
}

function isChangeMark(mark: Mark, types: ChangeTypes): boolean {
  return mark.type === types.insertion || mark.type === types.deletion;
}

/**
 * Whether a transaction writes change marks itself, such as an AI
 * suggestion: it adds or removes them, or inserts text carrying a change
 * mark that typing could not have picked up from the text around it.
 * Pastes and drops are tracked like typing either way.
 */
function writesChanges(tr: Transaction, types: ChangeTypes): boolean {
  const uiEvent = tr.getMeta("uiEvent") as string | undefined;
  return tr.steps.some((step, index) => {
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) return isChangeMark(step.mark, types);
    if (!(step instanceof ReplaceStep) || !step.slice.size || uiEvent === "paste" || uiEvent === "drop") return false;
    const doc = tr.docs[index]!;
    const $from = doc.resolve(step.from);
    const nearby: Mark[] = [];
    doc.nodesBetween(Math.max($from.start(), step.from - 1), Math.min(doc.resolve(step.to).end(), step.to + 1), (node) => {
      if (node.isInline) nearby.push(...node.marks.filter((mark) => isChangeMark(mark, types)));
      return true;
    });
    let written = false;
    step.slice.content.descendants((node) => {
      if (node.isInline && node.marks.some((mark) => isChangeMark(mark, types) && !mark.isInSet(nearby))) written = true;
      return !written;
    });
    return written;
  });
}

function leftAlone(tr: Transaction, options: TrackChangesOptions, types: ChangeTypes): boolean {
  return !tr.docChanged || tr.getMeta(trackChangesKey) !== undefined || tr.getMeta("appendedTransaction") !== undefined || isHistoryTransaction(tr) || Boolean(options.skip?.(tr)) || writesChanges(tr, types);
}

/**
 * The text each tracked replace step inserted and deleted, mapped to the
 * final document. Only edits inside textblocks count, unless the edit
 * replaced a select-all; a step replacing the whole document from another
 * selection is a full reload (the source view or setHTML) and is skipped.
 */
function pendingEdits(transactions: readonly Transaction[], oldState: EditorState, options: TrackChangesOptions, types: ChangeTypes): { insertions: PendingInsertion[]; deletions: PendingDeletion[] } {
  const entries: Array<{ step: Step; doc: ProseMirrorNode; tracked: boolean; typed: boolean; first: boolean }> = [];
  const mapping = new Mapping();
  transactions.forEach((tr, trIndex) => {
    const tracked = !leftAlone(tr, options, types);
    const uiEvent = tr.getMeta("uiEvent") as string | undefined;
    tr.steps.forEach((step, index) => {
      entries.push({ step, doc: tr.docs[index]!, tracked, typed: uiEvent !== "paste" && uiEvent !== "drop", first: trIndex === 0 && index === 0 });
      mapping.appendMap(step.getMap());
    });
  });
  const insertions: PendingInsertion[] = [];
  const deletions: PendingDeletion[] = [];
  const selection = oldState.selection;
  entries.forEach(({ step, doc, tracked, typed, first }, index) => {
    if (!tracked || !(step instanceof ReplaceStep)) return;
    const whole = first && selection instanceof AllSelection;
    if (!whole && step.from === 0 && step.to === doc.content.size) return;
    const toFinal = mapping.slice(index + 1);
    const $from = doc.resolve(step.from);
    const $to = doc.resolve(step.to);
    if (step.slice.size > 0 && (whole || $from.parent.inlineContent) && hasInline(step.slice.content)) {
      insertions.push({ from: toFinal.map(step.from, 1), to: toFinal.map(step.from + step.slice.size, -1), typed });
    }
    if (step.to > step.from && (whole || ($from.parent.inlineContent && $to.parent.inlineContent))) {
      const slice = doc.slice(step.from, step.to);
      if (!hasInline(slice.content)) return;
      deletions.push({
        at: toFinal.map(step.from, -1),
        slice,
        parent: $from.node($from.sharedDepth(step.to)).type,
        backward: first && selection.empty && step.slice.size === 0 && step.to === selection.head,
      });
    }
  });
  return { insertions, deletions };
}

/** Whether every inline node in deleted content was already marked deleted. */
function onlyDeleted(fragment: Fragment, types: ChangeTypes): boolean {
  let only = true;
  fragment.descendants((node) => {
    if (node.isInline && !types.deletion.isInSet(node.marks)) only = false;
    return only;
  });
  return only;
}

/** Attributes of a change of the same kind and author right beside a range, so continued typing or deleting extends it. */
function adjacentChange(doc: ProseMirrorNode, from: number, to: number, type: MarkType, author: string): Attrs | null {
  for (const node of [doc.resolve(from).nodeBefore, doc.resolve(to).nodeAfter]) {
    const mark = node ? type.isInSet(node.marks) : undefined;
    if (mark && mark.attrs.author === author) return mark.attrs;
  }
  return null;
}

/**
 * Deleted content to put back, marked as deleted. Your own pending
 * insertions are dropped (deleting them removes them), text already marked
 * deleted keeps its mark, and text in blocks that take no marks, such as
 * code blocks, is dropped too.
 */
function markDeleted(fragment: Fragment, parent: NodeType, mark: () => Mark, author: string, types: ChangeTypes): Fragment {
  const nodes: ProseMirrorNode[] = [];
  fragment.forEach((child) => {
    if (!child.isInline) {
      nodes.push(child.copy(markDeleted(child.content, child.type, mark, author, types)));
      return;
    }
    if (!parent.allowsMarkType(types.deletion)) return;
    const inserted = types.insertion.isInSet(child.marks);
    if (inserted && inserted.attrs.author === author) return;
    nodes.push(types.deletion.isInSet(child.marks) ? child : child.mark(mark().addToSet(child.marks)));
  });
  return Fragment.fromArray(nodes);
}

/**
 * Records edits as suggestions while `mode` is "track": inserted text gets
 * an `insertion` mark (continuing an adjacent one of yours), and deleted
 * text is put back with a `deletion` mark, except your own pending
 * insertions, which are removed outright. After Backspace the caret sits
 * before the deleted text, after Delete or a deleted selection it sits
 * after it, as in a word processor. Undo and redo, appended transactions,
 * transactions carrying `trackChangesKey` meta, those `skip` names and
 * those that write change marks themselves are left alone, as are
 * structural edits with no text to mark.
 */
export function trackChangesPlugin(options: TrackChangesOptions): Plugin {
  return new Plugin({
    key: trackChangesKey,
    appendTransaction: (transactions, oldState, newState) => {
      const mode = options.mode(newState);
      const types = changeTypes(newState.schema);
      if (mode === "off" || !types || transactions.every((tr) => leftAlone(tr, options, types))) return null;
      const { insertions, deletions } = pendingEdits(transactions, oldState, options, types);
      if (!insertions.length && !deletions.length) return null;
      const tr = newState.tr;
      if (mode === "idle") {
        for (const insertion of insertions) {
          if (!insertion.typed || insertion.from >= insertion.to) continue;
          tr.removeMark(insertion.from, insertion.to, types.insertion).removeMark(insertion.from, insertion.to, types.deletion);
        }
        let skipTo: number | null = null;
        for (const deletion of deletions) {
          if (!onlyDeleted(deletion.slice.content, types)) continue;
          const at = tr.mapping.map(deletion.at, -1);
          tr.replace(at, at, deletion.slice);
          if (deletion.backward) skipTo = at;
        }
        if (skipTo !== null) tr.setSelection(TextSelection.create(tr.doc, skipTo));
        return tr.docChanged ? tr.setMeta(trackChangesKey, "idle") : null;
      }
      const author = safeAuthor(options.author());
      const date = safeTimestamp((options.now?.() ?? new Date()).toISOString());
      const createId = options.createId ?? newMarkId;
      for (const insertion of insertions) {
        if (insertion.from >= insertion.to) continue;
        const attrs = adjacentChange(tr.doc, insertion.from, insertion.to, types.insertion, author) ?? { id: createId("ins"), author, date };
        tr.addMark(insertion.from, insertion.to, types.insertion.create(attrs));
      }
      let caret: number | null = null;
      for (const deletion of deletions) {
        const at = tr.mapping.map(deletion.at, -1);
        let mark: Mark | null = null;
        const deleted = () => (mark ??= types.deletion.create(adjacentChange(tr.doc, at, at, types.deletion, author) ?? { id: createId("del"), author, date }));
        const content = markDeleted(deletion.slice.content, deletion.parent, deleted, author, types);
        if (hasInline(content)) tr.replace(at, at, new Slice(content, deletion.slice.openStart, deletion.slice.openEnd));
        if (deletion.backward) caret = at;
      }
      if (caret !== null) tr.setSelection(TextSelection.create(tr.doc, caret));
      return tr.docChanged ? tr.setMeta(trackChangesKey, "track") : null;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Review highlights                                                   */
/* ------------------------------------------------------------------ */

/** What the review plugin keeps: the text being commented on, what the panel picked and what is active. */
export interface ReviewUiState {
  /** Text the comment composer is anchored to, mapped through edits. */
  draft: DocRange | null;
  /** A thread or change picked in the review panel; cleared when the selection moves. */
  focused: string | null;
  /** The open thread at the selection, or the focused one. */
  activeThread: string | null;
  /** Ids of the changes at the selection, or the focused one. */
  activeChanges: string[];
  decorations: DecorationSet;
}

export interface ReviewUiOptions {
  /** Ids of open comment threads to highlight, or null when comments are off. */
  openThreads: () => ReadonlySet<string> | null;
  /** Whether tracked changes get titles and an active highlight. */
  showChanges: () => boolean;
  /** Other transactions after which highlights are rebuilt, such as a change of props. */
  refresh?: (tr: Transaction) => boolean;
}

/** Set `{ draft }` or `{ focused }` as meta to open the composer or pick a thread or change. */
export const reviewUiKey = new PluginKey<ReviewUiState>("ai-ui-review-ui");

export interface ReviewUiMeta {
  draft?: DocRange | null;
  focused?: string | null;
}

function reviewState(state: EditorState, draft: DocRange | null, focused: string | null, options: ReviewUiOptions): ReviewUiState {
  const decorations: Decoration[] = [];
  const open = options.openThreads();
  let activeThread: string | null = null;
  if (open?.size) {
    const ranges = commentRanges(state.doc);
    activeThread = focused && open.has(focused) && ranges.has(focused) ? focused : commentAtSelection(ranges, open, state.selection);
    for (const [id, list] of ranges) {
      if (!open.has(id)) continue;
      const className = id === activeThread ? "review-comment review-comment-active" : "review-comment";
      for (const range of list) decorations.push(Decoration.inline(range.from, range.to, { class: className }));
    }
  }
  if (draft) decorations.push(Decoration.inline(draft.from, draft.to, { class: "review-comment-draft" }));
  let activeChanges: string[] = [];
  if (options.showChanges()) {
    const changes = listChanges(state.doc);
    const focusedChange = focused ? changes.find((change) => change.id === focused) : undefined;
    activeChanges = focusedChange ? [focusedChange.id] : changesInRange(changes, state.selection.from, state.selection.to).map((change) => change.id);
    for (const change of changes) {
      const title = `${change.kind === "insertion" ? "Added" : "Deleted"}${change.author ? ` by ${change.author}` : ""}`;
      const attrs = activeChanges.includes(change.id) ? { title, class: "review-change-active" } : { title };
      for (const range of change.ranges) decorations.push(Decoration.inline(range.from, range.to, attrs));
    }
  }
  return { draft, focused, activeThread, activeChanges, decorations: DecorationSet.create(state.doc, decorations) };
}

/**
 * Highlights open comment threads (the active one more strongly), the text
 * the composer is anchored to, and the tracked change at the selection, and
 * titles changes with their kind and author.
 */
export function reviewUiPlugin(options: ReviewUiOptions): Plugin<ReviewUiState> {
  return new Plugin<ReviewUiState>({
    key: reviewUiKey,
    state: {
      init: (_config, state) => reviewState(state, null, null, options),
      apply: (tr, previous, _old, state) => {
        const meta = tr.getMeta(reviewUiKey) as ReviewUiMeta | undefined;
        if (!meta && !tr.docChanged && !tr.selectionSet && !options.refresh?.(tr)) return previous;
        let draft = previous.draft;
        if (draft && tr.docChanged) {
          const from = tr.mapping.map(draft.from, 1);
          const to = tr.mapping.map(draft.to, -1);
          draft = from < to ? { from, to } : null;
        }
        if (meta && "draft" in meta) draft = meta.draft ?? null;
        let focused = previous.focused;
        if (meta && "focused" in meta) focused = meta.focused ?? null;
        else if (tr.selectionSet) focused = null;
        return reviewState(state, draft, focused, options);
      },
    },
    props: {
      decorations: (state) => reviewUiKey.getState(state)?.decorations ?? null,
    },
  });
}
