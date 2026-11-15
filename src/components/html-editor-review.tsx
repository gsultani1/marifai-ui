// packages/ai-ui/src/components/html-editor-review.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import { Toolbar } from "@base-ui/react/toolbar";
import { CheckIcon, FilePenLineIcon, MessageSquarePlusIcon, PanelRightIcon, XIcon } from "lucide-react";
import { keymap } from "prosemirror-keymap";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { type Command, type EditorState, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { type KeyboardEvent, type RefObject, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing, iconButton, popupSurface, tabList, tabTrigger } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";
import {
  acceptChanges,
  addComment,
  type ChangeAction,
  changesInRange,
  type DocRange,
  listChanges,
  newMarkId,
  rejectChanges,
  removeComment,
  reviewUiKey,
  type ReviewUiMeta,
  reviewUiPlugin,
  type TrackedChange,
  trackChangesPlugin,
} from "../lib/rich-text/html-review.js";
import { commentRanges } from "../lib/rich-text/plugins.js";
import { usePortalContainer } from "../lib/portal.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { HTML_EDITOR_PROPS_META, type HtmlEditorExtension, type HtmlEditorExtensionSetup, type HtmlEditorRenderProps, surfacePosition } from "./html-editor-extension.js";
import type { HtmlEditorViewProps } from "./html-editor-view.js";
import type { RichTextComment } from "./rich-text-editor-view.js";
import { editorTool, EXTERNAL_UPDATE, ToolbarSeparator } from "./rich-text-parts.js";

/* ------------------------------------------------------------------ */
/* Feature state                                                       */
/* ------------------------------------------------------------------ */

function commentsOn(props: HtmlEditorViewProps): boolean {
  return !props.compact && props.comments !== undefined;
}

function reviewOn(props: HtmlEditorViewProps): boolean {
  return !props.compact && Boolean(props.review);
}

/** Comments can be added and answered: the feature is on, the editor is editable and changes have somewhere to go. */
function canComment(props: HtmlEditorViewProps): boolean {
  return commentsOn(props) && !props.readOnly && Boolean(props.onCommentsChange);
}

/** Bulk accept or reject asks first above this many changes. */
const CONFIRM_ABOVE = 10;

type ReviewTab = "comments" | "changes";
type ThreadFilter = "open" | "resolved";

/** Editors narrower than this show the review panel over the document, opened from a toggle, instead of beside it. */
const NARROW_BELOW = 640;

interface PanelState {
  /** The editor is narrower than NARROW_BELOW. */
  narrow: boolean;
  /** The editor's measured width, or 0 before layout. */
  width: number;
  /** Open beside the document in a wide editor; on by default. */
  wideOpen: boolean;
  /** Open over the document in a narrow editor; off by default. */
  narrowOpen: boolean;
  tab: ReviewTab;
  filter: ThreadFilter;
}

/** The review panel's open state, tab and filter, shared by the toolbar, the panel and the composer of one editor. */
interface PanelStore {
  get: () => PanelState;
  set: (patch: Partial<PanelState>) => void;
  subscribe: (listener: () => void) => () => void;
}

function createPanelStore(): PanelStore {
  let state: PanelState = { narrow: false, width: 0, wideOpen: true, narrowOpen: false, tab: "comments", filter: "open" };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function usePanel(store: PanelStore): PanelState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Whether the panel shows. Read-only editors have no toolbar to reopen it, so it stays open beside a wide document. */
function panelOpen(state: PanelState, readOnly: boolean): boolean {
  return state.narrow ? state.narrowOpen : state.wideOpen || readOnly;
}

function setPanelOpen(store: PanelStore, open: boolean): void {
  store.set(store.get().narrow ? { narrowOpen: open } : { wideOpen: open });
}

const changeCache = new WeakMap<ProseMirrorNode, TrackedChange[]>();

/** listChanges, computed once per document. */
function changesOf(doc: ProseMirrorNode): TrackedChange[] {
  let changes = changeCache.get(doc);
  if (!changes) {
    changes = listChanges(doc);
    changeCache.set(doc, changes);
  }
  return changes;
}

function commentShortcut(): { label: string; aria: string } {
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  return apple ? { label: "⌘⌥M", aria: "Meta+Alt+M" } : { label: "Ctrl+Alt+M", aria: "Control+Alt+M" };
}

/** Opens the comment composer on the selected text. */
const openComposer: Command = (state, dispatch) => {
  const { from, to, empty, ranges } = state.selection;
  if (empty || ranges.length !== 1 || !state.doc.textBetween(from, to, " ", " ").trim()) return false;
  dispatch?.(state.tr.setMeta(reviewUiKey, { draft: { from, to } } satisfies ReviewUiMeta));
  return true;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Selects a range without moving focus, marks it as picked in the panel and scrolls it into the middle of the surface. */
function revealRange(view: EditorView, surface: HTMLElement | null, range: DocRange, focused: string): void {
  const { doc } = view.state;
  const from = Math.min(range.from, doc.content.size);
  const to = Math.min(range.to, doc.content.size);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, from, to)).setMeta(reviewUiKey, { focused } satisfies ReviewUiMeta));
  if (!surface) return;
  try {
    const { top } = surfacePosition(view, surface, from);
    surface.scrollTo({ top: Math.max(0, top - surface.clientHeight / 3), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  } catch {
    // Positions without layout (hidden editors) have nothing to scroll to.
  }
}

/** Reveals a thread or change picked in the panel; over a narrow document the panel closes and the document takes focus, so the text is visible. */
function revealFromPanel(review: ReviewContext, view: EditorView, surface: HTMLElement | null, range: DocRange, focused: string): void {
  revealRange(view, surface, range, focused);
  if (!review.panel.get().narrow) return;
  review.panel.set({ narrowOpen: false });
  view.focus();
}

/** Moves focus to the item now at `index` in a list that just lost one, or to `fallback`. */
function focusListItem(list: RefObject<HTMLElement | null>, index: number, fallback?: () => HTMLElement | null | undefined): void {
  requestAnimationFrame(() => {
    const items = list.current?.querySelectorAll<HTMLElement>("[data-review-focus]") ?? [];
    const target = items[Math.min(index, items.length - 1)] ?? fallback?.();
    target?.focus();
  });
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

const SURFACE_CLASS = cn(
  "[&_.review-comment]:rounded-sm [&_.review-comment]:bg-warning/15 [&_.review-comment]:shadow-[inset_0_-2px_0_var(--warning)] [&_.review-comment-active]:bg-warning/35",
  "[&_.review-comment-draft]:rounded-sm [&_.review-comment-draft]:bg-primary/15 [&_.review-comment-draft]:shadow-[inset_0_-2px_0_var(--primary)]",
  "[&_ins]:bg-success/15 [&_ins]:text-foreground [&_ins]:underline [&_ins]:decoration-success [&_ins]:decoration-2 [&_ins]:underline-offset-2",
  "[&_del]:bg-destructive/10 [&_del]:text-foreground [&_del]:line-through [&_del]:decoration-destructive [&_del]:decoration-2 [&_del_img]:opacity-50",
  "[&_.review-change-active]:rounded-sm [&_.review-change-active]:outline-2 [&_.review-change-active]:outline-ring",
);

const smallButton = cn(button, "h-7 px-2 text-xs", focusRing);

/* ------------------------------------------------------------------ */
/* Shared context                                                      */
/* ------------------------------------------------------------------ */

interface ReviewContext {
  panel: PanelStore;
  panelId: string;
}

type ReviewRenderProps = HtmlEditorRenderProps & { review: ReviewContext };

let panelCount = 0;

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function ReviewToolbar({ review, props, state, viewRef, locked, readOnly, setStatus }: ReviewRenderProps) {
  const panel = usePanel(review.panel);
  const open = panelOpen(panel, readOnly);
  const comments = commentsOn(props);
  const tracking = reviewOn(props);
  if (!comments && !tracking) return null;
  const keys = commentShortcut();
  const trackOn = Boolean(props.trackChanges);
  return (
    <>
      <ToolbarSeparator />
      {canComment(props) && (
        <Toolbar.Button
          aria-label="Add comment"
          title={`Add comment (${keys.label})`}
          aria-keyshortcuts={keys.aria}
          disabled={locked || !openComposer(state)}
          onClick={() => {
            const view = viewRef.current;
            if (view) openComposer(view.state, view.dispatch);
          }}
          className={editorTool}
        >
          <MessageSquarePlusIcon aria-hidden="true" />
        </Toolbar.Button>
      )}
      {tracking && (
        <Toolbar.Button
          aria-label="Track changes"
          title="Track changes"
          aria-pressed={trackOn}
          disabled={locked}
          onClick={() => {
            props.onTrackChangesChange?.(!trackOn);
            setStatus(trackOn ? "Track changes off. Edits change the text directly." : "Track changes on. Edits are suggested as changes.");
          }}
          className={editorTool}
        >
          <FilePenLineIcon aria-hidden="true" />
        </Toolbar.Button>
      )}
      <Toolbar.Button aria-label="Review panel" title="Review panel" aria-pressed={open} {...(open ? { "aria-controls": review.panelId } : {})} onClick={() => setPanelOpen(review.panel, !open)} className={editorTool}>
        <PanelRightIcon aria-hidden="true" />
      </Toolbar.Button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Selection toolbar                                                   */
/* ------------------------------------------------------------------ */

function ReviewBubble({ props, state, run, readOnly, locked, setStatus }: ReviewRenderProps) {
  if (readOnly || locked) return null;
  const comment = canComment(props) && openComposer(state);
  const { from, to } = state.selection;
  const changes = reviewOn(props) ? changesInRange(changesOf(state.doc), from, to) : [];
  if (!comment && !changes.length) return null;
  const keys = commentShortcut();
  const resolve = (action: ChangeAction) => {
    const ids = changes.map((change) => change.id);
    if (run(action === "accept" ? acceptChanges(ids) : rejectChanges(ids))) setStatus(`${action === "accept" ? "Accepted" : "Rejected"} ${plural(ids.length, "change")}`);
  };
  const bubbleTool = cn(editorTool, "w-auto gap-1.5 px-2 text-sm font-medium text-foreground");
  return (
    <>
      {comment && (
        <Toolbar.Button aria-keyshortcuts={keys.aria} title={`Comment (${keys.label})`} onMouseDown={(event) => event.preventDefault()} onClick={() => run(openComposer)} className={bubbleTool}>
          <MessageSquarePlusIcon aria-hidden="true" />
          Comment
        </Toolbar.Button>
      )}
      {changes.length > 0 && (
        <>
          <Toolbar.Button title={`Accept ${plural(changes.length, "change")}`} onMouseDown={(event) => event.preventDefault()} onClick={() => resolve("accept")} className={bubbleTool}>
            <CheckIcon aria-hidden="true" />
            Accept
          </Toolbar.Button>
          <Toolbar.Button title={`Reject ${plural(changes.length, "change")}`} onMouseDown={(event) => event.preventDefault()} onClick={() => resolve("reject")} className={bubbleTool}>
            <XIcon aria-hidden="true" />
            Reject
          </Toolbar.Button>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Comment composer                                                    */
/* ------------------------------------------------------------------ */

/** The bounding box of a range in viewport coordinates, for anchoring a popup under it. */
function rangeRect(view: EditorView | null, range: DocRange): DOMRect {
  if (!view) return new DOMRect();
  try {
    const size = view.state.doc.content.size;
    const start = view.coordsAtPos(Math.min(range.from, size), 1);
    const end = view.coordsAtPos(Math.min(range.to, size), -1);
    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    return new DOMRect(left, top, Math.max(1, right - left), Math.max(start.bottom, end.bottom) - top);
  } catch {
    return view.dom.getBoundingClientRect();
  }
}

function CommentComposer({ review, props, state, viewRef, setStatus }: ReviewRenderProps) {
  const draft = reviewUiKey.getState(state)?.draft ?? null;
  const container = usePortalContainer();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const anchor = useCallback(() => (draft ? { getBoundingClientRect: () => rangeRect(viewRef.current, draft), contextElement: viewRef.current?.dom } : null), [draft, viewRef]);
  if (!draft || !canComment(props)) return null;
  const quote = state.doc.textBetween(draft.from, Math.min(draft.to, state.doc.content.size), " ", " ").trim();

  const close = (refocus: boolean) => {
    setText("");
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(view.state.tr.setMeta(reviewUiKey, { draft: null } satisfies ReviewUiMeta));
    if (refocus) view.focus();
  };

  const save = () => {
    const view = viewRef.current;
    const body = text.trim();
    if (!view || !body) return;
    const id = newMarkId("comment");
    if (!addComment(id, draft)(view.state, (tr) => view.dispatch(tr.setMeta(reviewUiKey, { draft: null, focused: id } satisfies ReviewUiMeta)))) return;
    const author = props.author?.trim();
    const thread: RichTextComment = { id, body, ...(author ? { author } : {}), createdAt: Date.now() };
    props.onCommentsChange?.([...(props.comments ?? []), thread]);
    review.panel.set({ wideOpen: true, tab: "comments", filter: "open" });
    setText("");
    setStatus("Comment added");
    view.focus();
  };

  return (
    <Popover.Root
      open
      onOpenChange={(open, details) => {
        if (!open) close(details.reason !== "outside-press");
      }}
    >
      <Popover.Portal container={container}>
        <Popover.Positioner anchor={anchor} side="bottom" align="start" sideOffset={8} collisionPadding={8} className="z-50">
          <Popover.Popup initialFocus={textareaRef} finalFocus={false} data-slot="html-comment-composer" className={cn(popupSurface, "flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-2 p-3 text-sm outline-none")}>
            <Popover.Title className="font-medium">Add a comment</Popover.Title>
            {quote && <Popover.Description className="line-clamp-2 border-l-2 border-warning pl-2 text-xs text-muted-foreground">{quote}</Popover.Description>}
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <textarea
                ref={textareaRef}
                aria-label="Comment"
                rows={3}
                value={text}
                placeholder="Write a comment"
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    save();
                  }
                }}
                className={cn("resize-y rounded-md border border-input bg-background px-2 py-1 text-foreground placeholder:text-muted-foreground", focusRing)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => close(true)} className={cn(smallButton, buttonVariants.ghost)}>
                  Cancel
                </button>
                <button type="submit" disabled={!text.trim()} title="Comment (Ctrl+Enter)" className={cn(smallButton, buttonVariants.primary)}>
                  Comment
                </button>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Comments tab                                                        */
/* ------------------------------------------------------------------ */

interface ThreadActions {
  editable: boolean;
  now: number;
  reveal: (thread: RichTextComment) => void;
  reply: (thread: RichTextComment, body: string) => void;
  setResolved: (thread: RichTextComment, resolved: boolean, index: number) => void;
  remove: (thread: RichTextComment, index: number) => void;
}

function ThreadCard({ thread, index, quote, active, actions }: { thread: RichTextComment; index: number; quote: string | null; active: boolean; actions: ThreadActions }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const author = thread.author || "Comment";
  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    actions.reply(thread, body);
    setDraft("");
  };
  return (
    <li>
      <article aria-labelledby={`${id}-author`} data-active={active || undefined} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2 data-[active]:border-warning data-[active]:shadow-[inset_3px_0_0_var(--warning)]">
        {quote !== null ? (
          <button type="button" data-review-focus="" onClick={() => actions.reveal(thread)} className={cn("line-clamp-2 rounded border-l-2 border-warning pl-2 text-left text-xs text-muted-foreground hover:text-foreground", focusRing)}>
            <span className="sr-only">Go to commented text: </span>
            {quote}
          </button>
        ) : (
          <p data-review-focus="" tabIndex={-1} className="rounded border-l-2 border-border pl-2 text-xs text-muted-foreground italic outline-none">
            The commented text was removed
          </p>
        )}
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
          <span id={`${id}-author`} className="font-medium text-foreground">
            {author}
          </span>
          {thread.createdAt !== undefined && <time dateTime={new Date(thread.createdAt).toISOString()}>{formatRelativeTime(thread.createdAt, actions.now)}</time>}
        </p>
        <p className="break-words whitespace-pre-wrap">{thread.body}</p>
        {thread.replies?.length ? (
          <ul aria-label={`Replies to ${author}`} className="flex flex-col gap-1.5">
            {thread.replies.map((item) => (
              <li key={item.id} className="border-l-2 border-border pl-2">
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.author || "Reply"}</span>
                  {item.createdAt !== undefined && <time dateTime={new Date(item.createdAt).toISOString()}>{formatRelativeTime(item.createdAt, actions.now)}</time>}
                </p>
                <p className="break-words whitespace-pre-wrap">{item.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {actions.editable && !thread.resolved && (
          <form
            className="flex gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input aria-label={`Reply to ${author}`} placeholder="Reply" value={draft} onChange={(event) => setDraft(event.target.value)} className={cn("h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground", focusRing)} />
            <button type="submit" disabled={!draft.trim()} className={cn(smallButton, buttonVariants.outline)}>
              Reply
            </button>
          </form>
        )}
        {actions.editable && (
          <div className="flex justify-end gap-1">
            <button type="button" aria-describedby={`${id}-author`} onClick={() => actions.remove(thread, index)} className={cn(smallButton, "text-destructive hover:bg-destructive/10")}>
              Delete
            </button>
            <button type="button" aria-describedby={`${id}-author`} onClick={() => actions.setResolved(thread, !thread.resolved, index)} className={cn(smallButton, buttonVariants.outline)}>
              {thread.resolved ? "Reopen" : "Resolve"}
            </button>
          </div>
        )}
      </article>
    </li>
  );
}

function CommentsTab({ review, props, state, viewRef, surfaceRef, readOnly, setStatus }: ReviewRenderProps) {
  const panel = usePanel(review.panel);
  const now = useNow(60_000);
  const listRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const ranges = useMemo(() => commentRanges(state.doc), [state.doc]);
  const threads = props.comments ?? [];
  const active = reviewUiKey.getState(state)?.activeThread ?? null;
  const editable = !readOnly && Boolean(props.onCommentsChange);
  const firstPos = (thread: RichTextComment) => ranges.get(thread.id)?.[0]?.from ?? Number.MAX_SAFE_INTEGER;
  const open = threads.filter((thread) => !thread.resolved);
  const shown = (panel.filter === "open" ? open : threads.filter((thread) => thread.resolved)).sort((a, b) => firstPos(a) - firstPos(b));
  const anchored = shown.filter((thread) => ranges.has(thread.id));
  const removed = shown.filter((thread) => !ranges.has(thread.id));
  const resolvedCount = threads.length - open.length;

  const update = (next: RichTextComment[]) => props.onCommentsChange?.(next);
  const focusFilter = () => filterRef.current?.querySelector<HTMLElement>("[aria-pressed=true]");
  const actions: ThreadActions = {
    editable,
    now,
    reveal: (thread) => {
      const view = viewRef.current;
      const list = ranges.get(thread.id);
      if (view && list?.length) revealFromPanel(review, view, surfaceRef.current, { from: list[0]!.from, to: list.at(-1)!.to }, thread.id);
    },
    reply: (thread, body) => {
      const author = props.author?.trim();
      update(threads.map((item) => (item.id === thread.id ? { ...item, replies: [...(item.replies ?? []), { id: newMarkId("reply"), body, ...(author ? { author } : {}), createdAt: Date.now() }] } : item)));
      setStatus("Reply added");
    },
    setResolved: (thread, resolved, index) => {
      update(threads.map((item) => (item.id === thread.id ? { ...item, resolved } : item)));
      setStatus(resolved ? "Comment resolved" : "Comment reopened");
      focusListItem(listRef, index, focusFilter);
    },
    remove: (thread, index) => {
      const view = viewRef.current;
      if (view) removeComment(thread.id)(view.state, view.dispatch);
      update(threads.filter((item) => item.id !== thread.id));
      setStatus("Comment deleted");
      focusListItem(listRef, index, focusFilter);
    },
  };
  const card = (thread: RichTextComment, index: number) => {
    const list = ranges.get(thread.id);
    const quote = list?.length ? state.doc.textBetween(list[0]!.from, list.at(-1)!.to, " ", " ").trim() : null;
    return <ThreadCard key={thread.id} thread={thread} index={index} quote={quote} active={active === thread.id} actions={actions} />;
  };
  const filterButton = (value: ThreadFilter, label: string, count: number) => (
    <button type="button" aria-pressed={panel.filter === value} onClick={() => review.panel.set({ filter: value })} className={cn(tabTrigger, "aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm", focusRing)}>
      {label} <span className="tabular-nums">{count}</span>
    </button>
  );

  return (
    <div ref={listRef} className="flex flex-col gap-2">
      <div ref={filterRef} role="group" aria-label="Show comments" className={tabList}>
        {filterButton("open", "Open", open.length)}
        {filterButton("resolved", "Resolved", resolvedCount)}
      </div>
      {shown.length === 0 && (
        <p className="px-1 text-muted-foreground">{panel.filter === "open" ? (editable ? "No open comments. Select text and choose Comment." : "No open comments.") : "No resolved comments."}</p>
      )}
      {anchored.length > 0 && (
        <ul aria-label={panel.filter === "open" ? "Open comments" : "Resolved comments"} className="flex flex-col gap-2">
          {anchored.map((thread, index) => card(thread, index))}
        </ul>
      )}
      {removed.length > 0 && (
        <>
          <h3 className="px-1 pt-1 text-xs font-medium text-muted-foreground">Text removed</h3>
          <ul aria-label="Comments on removed text" className="flex flex-col gap-2">
            {removed.map((thread, index) => card(thread, anchored.length + index))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Changes tab                                                         */
/* ------------------------------------------------------------------ */

function ChangeItem({ change, index, active, editable, now, onReveal, onResolve }: { change: TrackedChange; index: number; active: boolean; editable: boolean; now: number; onReveal: () => void; onResolve: (action: ChangeAction, index: number) => void }) {
  const id = useId();
  const added = change.kind === "insertion";
  const date = change.date ? Date.parse(change.date) : Number.NaN;
  return (
    <li data-active={active || undefined} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2 data-[active]:border-ring">
      <button type="button" data-review-focus="" onClick={onReveal} className={cn("flex flex-col items-start gap-1 rounded text-left", focusRing)}>
        <span id={`${id}-summary`} className="flex max-w-full flex-col items-start gap-1">
          <span className={cn("rounded px-1.5 text-xs font-medium", added ? "bg-success/15 text-foreground" : "bg-destructive/10 text-foreground")}>{added ? "Added" : "Deleted"}</span>
          <span className={cn("line-clamp-2 break-words", !added && "line-through decoration-destructive")}>{change.text || (added ? "Inserted content" : "Deleted content")}</span>
        </span>
      </button>
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{change.author || "Unknown author"}</span>
        {Number.isFinite(date) && <time dateTime={change.date}>{formatRelativeTime(date, now)}</time>}
      </p>
      {editable && (
        <div className="flex justify-end gap-1">
          <button type="button" aria-describedby={`${id}-summary`} onClick={() => onResolve("reject", index)} className={cn(smallButton, buttonVariants.outline)}>
            <XIcon aria-hidden="true" />
            Reject
          </button>
          <button type="button" aria-describedby={`${id}-summary`} onClick={() => onResolve("accept", index)} className={cn(smallButton, buttonVariants.outline)}>
            <CheckIcon aria-hidden="true" />
            Accept
          </button>
        </div>
      )}
    </li>
  );
}

function ChangesTab({ review, state, viewRef, surfaceRef, readOnly, run, setStatus }: ReviewRenderProps) {
  const now = useNow(60_000);
  const listRef = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState<ChangeAction | null>(null);
  const changes = changesOf(state.doc);
  const active = reviewUiKey.getState(state)?.activeChanges ?? [];
  const editable = !readOnly;

  const resolveOne = (change: TrackedChange, action: ChangeAction, index: number) => {
    const view = viewRef.current;
    if (!view || !(action === "accept" ? acceptChanges([change.id]) : rejectChanges([change.id]))(view.state, view.dispatch)) return;
    setStatus(`${action === "accept" ? "Accepted" : "Rejected"} ${change.kind === "insertion" ? "added" : "deleted"} text${change.text ? `: ${change.text.slice(0, 60)}` : ""}`);
    focusListItem(listRef, index, () => listRef.current?.querySelector<HTMLElement>("[data-review-all]") ?? listRef.current?.closest<HTMLElement>('[role="tabpanel"]'));
  };
  const resolveAll = (action: ChangeAction) => {
    const count = changes.length;
    if (run(action === "accept" ? acceptChanges() : rejectChanges())) setStatus(`${action === "accept" ? "Accepted" : "Rejected"} ${plural(count, "change")}`);
  };
  const requestAll = (action: ChangeAction) => (changes.length > CONFIRM_ABOVE ? setConfirm(action) : resolveAll(action));

  return (
    <div ref={listRef} className="flex flex-col gap-2">
      {editable && changes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button type="button" data-review-all="" onClick={() => requestAll("accept")} className={cn(smallButton, buttonVariants.outline)}>
            <CheckIcon aria-hidden="true" />
            Accept all
          </button>
          <button type="button" onClick={() => requestAll("reject")} className={cn(smallButton, buttonVariants.outline)}>
            <XIcon aria-hidden="true" />
            Reject all
          </button>
        </div>
      )}
      {changes.length === 0 ? (
        <p className="px-1 text-muted-foreground">{editable ? "No tracked changes. Turn on Track changes to suggest edits." : "No tracked changes."}</p>
      ) : (
        <ul aria-label="Tracked changes" className="flex flex-col gap-2">
          {changes.map((change, index) => (
            <ChangeItem
              key={`${change.kind}:${change.id}`}
              change={change}
              index={index}
              active={active.includes(change.id)}
              editable={editable}
              now={now}
              onReveal={() => {
                const view = viewRef.current;
                if (view) revealFromPanel(review, view, surfaceRef.current, { from: change.from, to: change.to }, change.id);
              }}
              onResolve={(action, at) => resolveOne(change, action, at)}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "reject" ? `Reject all ${changes.length} changes?` : `Accept all ${changes.length} changes?`}
        description={confirm === "reject" ? "Suggested insertions are removed and deleted text is restored. You can undo this." : "Suggested insertions stay and deleted text is removed. You can undo this."}
        confirmLabel={confirm === "reject" ? "Reject all" : "Accept all"}
        tone={confirm === "reject" ? "destructive" : "default"}
        onConfirm={() => {
          if (confirm) resolveAll(confirm);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

function ReviewAside(renderProps: ReviewRenderProps) {
  const { review, props, state, readOnly, surfaceRef, viewRef } = renderProps;
  const panel = usePanel(review.panel);
  const asideRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const comments = commentsOn(props);
  const tracking = reviewOn(props);
  const active = comments || tracking;
  const open = active && panelOpen(panel, readOnly);
  const overlay = open && panel.narrow;

  // The editor's own width decides the layout, so a narrow editor on a wide screen also gets the overlay.
  useLayoutEffect(() => {
    const row = surfaceRef.current?.parentElement;
    if (!active || !row) return;
    const measure = () => {
      const width = Math.round(row.getBoundingClientRect().width);
      const current = review.panel.get();
      if (width > 0 && width !== current.width) review.panel.set({ width, narrow: width < NARROW_BELOW });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [active, review.panel, surfaceRef]);

  useEffect(() => {
    if (!overlay) return;
    const opener = document.activeElement;
    openerRef.current = opener instanceof HTMLElement && opener !== document.body ? opener : null;
    // Next frame, once the tab list has registered its tabs for arrow key navigation.
    const frame = requestAnimationFrame(() => asideRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
    const surface = surfaceRef.current;
    const dismiss = () => review.panel.set({ narrowOpen: false });
    surface?.addEventListener("pointerdown", dismiss);
    return () => {
      cancelAnimationFrame(frame);
      surface?.removeEventListener("pointerdown", dismiss);
    };
  }, [overlay, review.panel, surfaceRef]);

  if (!active) return null;

  const close = () => {
    review.panel.set({ narrowOpen: false });
    const opener = openerRef.current;
    if (opener?.isConnected) opener.focus();
    else viewRef.current?.focus();
  };
  const tab: ReviewTab = comments && tracking ? panel.tab : comments ? "comments" : "changes";
  const openThreads = (props.comments ?? []).filter((thread) => !thread.resolved).length;
  const changeCount = tracking ? changesOf(state.doc).length : 0;
  const tabClass = cn(tabTrigger, "flex-1", focusRing);
  const body = open && (
    <aside
      ref={asideRef}
      id={review.panelId}
      aria-label="Review"
      data-slot="html-review-panel"
      {...(overlay
        ? {
            "data-overlay": "",
            style: { width: Math.min(288, panel.width - 32) },
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
              if (event.key !== "Escape" || event.defaultPrevented || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
              event.preventDefault();
              close();
            },
          }
        : {})}
      className={cn(
        "flex shrink-0 flex-col border-l border-border text-sm text-foreground",
        overlay ? "absolute inset-y-0 right-0 z-40 bg-background shadow-xl" : "w-72 max-w-[60%] bg-muted/30",
      )}
    >
      <Tabs.Root value={tab} onValueChange={(value) => review.panel.set({ tab: value as ReviewTab })} className="flex min-h-0 flex-1 flex-col">
        <div className="mx-2 mt-2 flex items-center gap-1">
          <Tabs.List aria-label="Review" className={cn(tabList, "min-w-0 flex-1 self-stretch")}>
            {comments && (
              <Tabs.Tab value="comments" className={tabClass}>
                Comments <span className="tabular-nums">{openThreads}</span>
              </Tabs.Tab>
            )}
            {tracking && (
              <Tabs.Tab value="changes" className={tabClass}>
                Changes <span className="tabular-nums">{changeCount}</span>
              </Tabs.Tab>
            )}
          </Tabs.List>
          {overlay && (
            <button type="button" aria-label="Close review panel" title="Close (Escape)" onClick={close} className={cn(iconButton, focusRing)}>
              <XIcon aria-hidden="true" />
            </button>
          )}
        </div>
        {comments && (
          <Tabs.Panel value="comments" className={cn("min-h-0 flex-1 overflow-y-auto p-2", focusRing)}>
            <CommentsTab {...renderProps} />
          </Tabs.Panel>
        )}
        {tracking && (
          <Tabs.Panel value="changes" className={cn("min-h-0 flex-1 overflow-y-auto p-2", focusRing)}>
            <ChangesTab {...renderProps} />
          </Tabs.Panel>
        )}
      </Tabs.Root>
    </aside>
  );
  // In a narrow editor a zero-width box at the right edge anchors the panel, which then opens leftward over the document.
  return panel.narrow ? <div className="relative w-0 shrink-0">{body}</div> : body || null;
}

function ReviewStatus({ review, props, state, readOnly }: ReviewRenderProps) {
  const panel = usePanel(review.panel);
  const comments = commentsOn(props);
  const tracking = reviewOn(props);
  const open = panelOpen(panel, readOnly);
  const count = (comments ? (props.comments ?? []).filter((thread) => !thread.resolved).length : 0) + (tracking ? changesOf(state.doc).length : 0);
  return (
    <>
      {tracking && props.trackChanges && !readOnly && (
        <span className="flex items-center gap-1 text-foreground">
          <FilePenLineIcon aria-hidden="true" className="size-3.5" />
          Tracking changes
        </span>
      )}
      {(comments || tracking) && panel.narrow && (
        <button
          type="button"
          aria-expanded={open}
          {...(open ? { "aria-controls": review.panelId } : {})}
          onClick={() => review.panel.set({ narrowOpen: !open })}
          className={cn("flex items-center gap-1 rounded px-1 text-foreground hover:bg-accent", focusRing)}
        >
          <PanelRightIcon aria-hidden="true" className="size-3.5" />
          Review <span className="tabular-nums">{count}</span>
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Extension                                                           */
/* ------------------------------------------------------------------ */

/**
 * Review for HtmlEditorView. Comments (on when `comments` is set): a
 * Comment button in the selection toolbar, an Add comment toolbar button
 * and Ctrl+Alt+M open a composer under the selection; threads are
 * highlighted in the text and listed in the review panel in document order
 * with reply, resolve, reopen and delete. Track changes (on with `review`):
 * a toolbar switch bound to `trackChanges` records typing, deleting,
 * pasting and cutting as insertion and deletion suggestions; the panel and
 * the selection toolbar accept or reject them one at a time or all at once.
 * Block-level edits (block types, lists, tables, block nodes) apply
 * normally while tracking. In editors narrower than 640px the panel
 * collapses to a toggle and opens over the document.
 */
export function createReviewExtension(setup: HtmlEditorExtensionSetup): HtmlEditorExtension {
  const review: ReviewContext = { panel: createPanelStore(), panelId: `ai-ui-review-panel-${++panelCount}` };
  const plugins = [
    trackChangesPlugin({
      mode: () => {
        const props = setup.getProps();
        if (!reviewOn(props)) return "off";
        return props.trackChanges && !props.readOnly ? "track" : "idle";
      },
      author: () => setup.getProps().author ?? "",
      skip: (tr) => Boolean(tr.getMeta(EXTERNAL_UPDATE)),
    }),
    reviewUiPlugin({
      openThreads: () => {
        const props = setup.getProps();
        return commentsOn(props) ? new Set((props.comments ?? []).filter((thread) => !thread.resolved).map((thread) => thread.id)) : null;
      },
      showChanges: () => reviewOn(setup.getProps()),
      refresh: (tr) => tr.getMeta(HTML_EDITOR_PROPS_META) !== undefined,
    }),
    keymap({
      "Mod-Alt-m": (state: EditorState, dispatch) => canComment(setup.getProps()) && openComposer(state, dispatch),
    }),
  ];
  return {
    name: "review",
    plugins,
    surfaceClassName: (props) => (commentsOn(props) || reviewOn(props) ? SURFACE_CLASS : undefined),
    Toolbar: function ReviewToolbarSlot(props: HtmlEditorRenderProps) {
      return <ReviewToolbar {...props} review={review} />;
    },
    Bubble: function ReviewBubbleSlot(props: HtmlEditorRenderProps) {
      return <ReviewBubble {...props} review={review} />;
    },
    Overlay: function ReviewOverlaySlot(props: HtmlEditorRenderProps) {
      return <CommentComposer {...props} review={review} />;
    },
    Aside: function ReviewAsideSlot(props: HtmlEditorRenderProps) {
      return <ReviewAside {...props} review={review} />;
    },
    Status: function ReviewStatusSlot(props: HtmlEditorRenderProps) {
      return <ReviewStatus {...props} review={review} />;
    },
  };
}
