// packages/ai-ui/src/components/rich-text-editor-view.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  CodeIcon,
  DownloadIcon,
  HighlighterIcon,
  ImageIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquarePlusIcon,
  MinusIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  SearchIcon,
  StrikethroughIcon,
  Table2Icon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { history, redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import type { Slice } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { isInTable, tableEditing } from "prosemirror-tables";
import type { EditorView } from "prosemirror-view";
import { type ReactNode, type Ref, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText as download } from "../lib/download.js";
import {
  buildKeymaps,
  clearFormatting,
  currentAlign,
  currentBlock,
  currentList,
  indentList,
  insertHorizontalRule,
  insertImage,
  insertTable,
  linkRange,
  outdentList,
  removeLink,
  setAlign,
  setBlock,
  setLink,
  toggleList,
} from "../lib/rich-text/commands.js";
import { docToHtml } from "../lib/rich-text/html.js";
import { docToMarkdown, markdownToDoc } from "../lib/rich-text/markdown.js";
import {
  commentHighlightPlugin,
  commentKey,
  commentRanges,
  filterSlashCommands,
  findPlugin,
  placeholderPlugin,
  RICH_TEXT_EVENTS,
  runSlashCommand,
  selectionSyncPlugin,
  slashKey,
  slashPlugin,
  taskItemView,
} from "../lib/rich-text/plugins.js";
import { richTextSchema } from "../lib/rich-text/schema.js";
import { usePortalContainer } from "../lib/portal.js";
import { ActionMenu } from "./action-menu.js";
import { BLOCK_LABELS, docCounts, docText, EDITOR_CONTENT_CLASS, editorTool, FindBar, MarkButton, printHtml, standaloneHtml, TableMenu, ToolbarSeparator, UrlDialog, useFindToggle, useProseEditor } from "./rich-text-parts.js";

export interface RichTextComment {
  id: string;
  body: string;
  author?: string;
  createdAt?: number;
  resolved?: boolean;
  replies?: Array<{ id: string; body: string; author?: string; createdAt?: number }>;
}

export interface RichTextDocument {
  markdown: () => string;
  html: () => string;
  json: () => unknown;
  text: () => string;
}

export interface RichTextEditorHandle {
  focus: () => void;
  getMarkdown: () => string;
  getHTML: () => string;
  getJSON: () => unknown;
  getText: () => string;
  /** Replaces the document; undo history keeps the change. */
  setMarkdown: (markdown: string) => void;
  insertText: (text: string) => void;
  /** The ProseMirror view, or null before mount. */
  getView: () => EditorView | null;
}

export interface RichTextEditorViewProps {
  /** Markdown content; when it changes from outside, the document is replaced. */
  value?: string;
  defaultValue?: string;
  /** Called with the new markdown after every change. */
  onValueChange?: (markdown: string) => void;
  /** Called after every change with lazy serializers. */
  onChange?: (document: RichTextDocument) => void;
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Comment threads anchored in the document. Supplying this shows the comments panel. */
  comments?: RichTextComment[];
  onCommentsChange?: (comments: RichTextComment[]) => void;
  /** Name stored on new comments and replies. */
  author?: string;
  /** File name without extension for downloads. */
  title?: string;
  /** Extra controls at the end of the toolbar. */
  toolbarActions?: ReactNode;
  className?: string;
  /** Height of the scrolling document area. */
  height?: number | string;
  "aria-label"?: string;
  ref?: Ref<RichTextEditorHandle>;
}

const CONTENT_CLASS = cn(EDITOR_CONTENT_CLASS, "[&_.rich-text-comment]:border-b-2 [&_.rich-text-comment]:border-warning [&_.rich-text-comment]:bg-warning/15 [&_.comment-active]:bg-warning/40");


/** Where the "/" menu goes, relative to the scrolling surface, or null when it is closed. */
function slashMenuPosition(view: EditorView, surface: HTMLElement | null): { left: number; top: number } | null {
  const slash = slashKey.getState(view.state);
  if (!surface || !slash?.active || filterSlashCommands(slash.query).length === 0) return null;
  try {
    const coords = view.coordsAtPos(slash.from);
    const rect = surface.getBoundingClientRect();
    return { left: coords.left - rect.left + surface.scrollLeft, top: coords.bottom - rect.top + surface.scrollTop + 4 };
  } catch {
    return null;
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Rich text editor on ProseMirror: toolbar, markdown shortcuts as you type,
 * a "/" command menu, lists and to-dos, tables, links and images with URL
 * allowlists, find and replace, anchored comments, word counts, markdown
 * round-trip, and export to Markdown, HTML and Word.
 */
export function RichTextEditorView({
  value,
  defaultValue = "",
  onValueChange,
  onChange,
  readOnly = false,
  placeholder = "Write, or type / for commands",
  autoFocus = false,
  comments,
  onCommentsChange,
  author,
  title = "Document",
  toolbarActions,
  className,
  height = "28rem",
  "aria-label": ariaLabel = "Document",
  ref,
}: RichTextEditorViewProps) {
  const id = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [draftComment, setDraftComment] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [slashPosition, setSlashPosition] = useState<{ left: number; top: number } | null>(null);
  const container = usePortalContainer();
  const viewRef = useRef<EditorView | null>(null);
  const finder = useFindToggle(viewRef);

  const { mountRef, editorState, run, replaceContent, lastValue } = useProseEditor({
    viewRef,
    createState: () =>
      EditorState.create({
        doc: markdownToDoc(value ?? defaultValue),
        plugins: [
          selectionSyncPlugin(),
          slashPlugin(),
          ...buildKeymaps(richTextSchema),
          history(),
          dropCursor({ color: "var(--primary)", width: 2 }),
          gapCursor(),
          tableEditing(),
          placeholderPlugin(placeholder),
          findPlugin(),
          commentHighlightPlugin(),
        ],
      }),
    value,
    initialValue: defaultValue,
    parse: markdownToDoc,
    serialize: docToMarkdown,
    readOnly,
    autoFocus,
    onChange: (markdown, state) => {
      onValueChange?.(markdown);
      onChange?.({ markdown: () => markdown, html: () => docToHtml(state.doc), json: () => state.doc.toJSON(), text: () => docText(state.doc) });
    },
    onTransaction: (view) => setSlashPosition(slashMenuPosition(view, surfaceRef.current)),
    viewProps: {
      nodeViews: { task_item: (node, nodeView, getPos) => taskItemView(node, nodeView, getPos) },
      attributes: (state) => {
        const slash = slashKey.getState(state);
        const items = slash?.active ? filterSlashCommands(slash.query) : [];
        return {
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": ariaLabel,
          class: CONTENT_CLASS,
          spellcheck: "true",
          ...(items.length ? { "aria-controls": `${id}-slash`, "aria-activedescendant": `${id}-slash-${Math.min(slash!.index, items.length - 1)}`, "aria-autocomplete": "list", "aria-expanded": "true" } : {}),
        };
      },
      clipboardTextParser: (text, _context, plain) => {
        if (plain || !/(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>|```|\|)|\*\*|__|\[[^\]]+\]\(/.test(text)) return null as unknown as Slice;
        const doc = markdownToDoc(text);
        return doc.slice(0, doc.content.size);
      },
    },
    events: [
      [RICH_TEXT_EVENTS.openLink, () => setLinkOpen(true)],
      [RICH_TEXT_EVENTS.openFind, () => finder.show()],
      [RICH_TEXT_EVENTS.openImage, () => setImageOpen(true)],
    ],
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      getMarkdown: () => (viewRef.current ? docToMarkdown(viewRef.current.state.doc) : lastValue.current),
      getHTML: () => (viewRef.current ? docToHtml(viewRef.current.state.doc) : ""),
      getJSON: () => viewRef.current?.state.doc.toJSON() ?? null,
      getText: () => (viewRef.current ? docText(viewRef.current.state.doc) : ""),
      setMarkdown: replaceContent,
      insertText: (text) => {
        const view = viewRef.current;
        if (view) view.dispatch(view.state.tr.insertText(text).scrollIntoView());
      },
      getView: () => viewRef.current,
    }),
    // The handle reads the view through refs, so it never needs rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ---------------- derived state ---------------- */

  const marks = richTextSchema.marks;
  const block = currentBlock(editorState);
  const list = currentList(editorState);
  const align = currentAlign(editorState);
  const inTable = isInTable(editorState);
  const link = linkRange(editorState);
  const hasSelection = !editorState.selection.empty;
  const slash = slashKey.getState(editorState);
  const slashItems = slash?.active ? filterSlashCommands(slash.query) : [];
  const counts = useMemo(() => docCounts(editorState.doc), [editorState.doc]);
  const ranges = useMemo(() => commentRanges(editorState.doc), [editorState.doc]);
  const activeComment = useMemo(() => {
    const { $from } = editorState.selection;
    const mark = $from.marks().find((item) => item.type === marks.comment) ?? $from.nodeAfter?.marks.find((item) => item.type === marks.comment);
    return (mark?.attrs.id as string | undefined) ?? null;
  }, [editorState.selection, marks.comment]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && commentKey.getState(view.state) !== activeComment) view.dispatch(view.state.tr.setMeta(commentKey, activeComment));
  }, [activeComment, viewRef]);

  /* ---------------- comments ---------------- */

  const commentsEnabled = comments !== undefined;
  const openComments = (comments ?? []).filter((comment) => !comment.resolved);
  const orderedComments = [...openComments].sort((a, b) => (ranges.get(a.id)?.[0]?.from ?? Number.MAX_SAFE_INTEGER) - (ranges.get(b.id)?.[0]?.from ?? Number.MAX_SAFE_INTEGER));

  const addComment = () => {
    const view = viewRef.current;
    const body = draftComment.trim();
    if (!view || !body || view.state.selection.empty) return;
    const commentId = newId("comment");
    const { from, to } = view.state.selection;
    view.dispatch(view.state.tr.addMark(from, to, marks.comment!.create({ id: commentId })));
    onCommentsChange?.([...(comments ?? []), { id: commentId, body, ...(author ? { author } : {}), createdAt: Date.now() }]);
    setDraftComment("");
    setCommentOpen(false);
    view.focus();
  };

  const removeCommentMarks = (commentId: string) => {
    const view = viewRef.current;
    if (!view) return;
    const tr = view.state.tr;
    for (const range of ranges.get(commentId) ?? []) tr.removeMark(range.from, range.to, marks.comment!.create({ id: commentId }));
    if (tr.docChanged) view.dispatch(tr);
  };

  const selectComment = (commentId: string) => {
    const view = viewRef.current;
    const range = ranges.get(commentId)?.[0];
    if (!view || !range) return;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)).scrollIntoView().setMeta(commentKey, commentId));
    view.focus();
  };

  const reply = (commentId: string) => {
    const body = replyDrafts[commentId]?.trim();
    if (!body) return;
    onCommentsChange?.((comments ?? []).map((comment) => (comment.id === commentId ? { ...comment, replies: [...(comment.replies ?? []), { id: newId("reply"), body, ...(author ? { author } : {}), createdAt: Date.now() }] } : comment)));
    setReplyDrafts({ ...replyDrafts, [commentId]: "" });
  };

  /* ---------------- export ---------------- */

  const getDoc = () => viewRef.current?.state.doc ?? editorState.doc;
  const exportAs = (format: "md" | "html" | "doc") => {
    const doc = getDoc();
    if (format === "md") download(`${title}.md`, docToMarkdown(doc), "text/markdown;charset=utf-8");
    else if (format === "html") download(`${title}.html`, standaloneHtml(title, docToHtml(doc)), "text/html;charset=utf-8");
    else download(`${title}.doc`, `\uFEFF${standaloneHtml(title, docToHtml(doc))}`, "application/msword");
  };

  /* ---------------- render ---------------- */

  const tool = editorTool;
  const separator = <ToolbarSeparator />;
  const markButton = (label: string, type: keyof typeof marks, icon: ReactNode, shortcut: string) => <MarkButton label={label} type={marks[type]!} icon={icon} shortcut={shortcut} state={editorState} run={run} disabled={readOnly} />;

  return (
    <div data-slot="rich-text-editor" className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground", className)}>
      {!readOnly && (
        <Toolbar.Root aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
          <Toolbar.Button aria-label="Undo" disabled={undoDepth(editorState) === 0} onClick={() => run(undo)} className={tool}>
            <Undo2Icon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Redo" disabled={redoDepth(editorState) === 0} onClick={() => run(redo)} className={tool}>
            <Redo2Icon aria-hidden="true" />
          </Toolbar.Button>
          {separator}
          <ActionMenu
            trigger={
              <Toolbar.Button className={cn(tool, "w-28 justify-between px-2 text-sm text-foreground")}>
                <span className="sr-only">Block type: </span>
                {BLOCK_LABELS.find((item) => item.kind === block)?.label ?? "Text"}
              </Toolbar.Button>
            }
            items={BLOCK_LABELS.map((item) => ({ id: item.kind, label: item.label, ...(item.shortcut ? { shortcut: item.shortcut } : {}), checked: block === item.kind, onSelect: () => run(setBlock(item.kind)) }))}
          />
          {separator}
          {markButton("Bold", "strong", <BoldIcon aria-hidden="true" />, "Ctrl+B")}
          {markButton("Italic", "em", <ItalicIcon aria-hidden="true" />, "Ctrl+I")}
          {markButton("Underline", "underline", <UnderlineIcon aria-hidden="true" />, "Ctrl+U")}
          {markButton("Strikethrough", "strike", <StrikethroughIcon aria-hidden="true" />, "Ctrl+Shift+X")}
          {markButton("Inline code", "code", <CodeIcon aria-hidden="true" />, "Ctrl+E")}
          {markButton("Highlight", "highlight", <HighlighterIcon aria-hidden="true" />, "Ctrl+Shift+H")}
          <UrlDialog
            open={linkOpen}
            onOpenChange={setLinkOpen}
            title={link ? "Edit link" : "Add link"}
            submitLabel={link ? "Update" : "Add link"}
            fields={[{ name: "href", label: "URL", initial: link?.href ?? "", placeholder: "https://example.com" }]}
            validate={(values) => (setLink(values.href ?? "")(editorState) ? null : "Use a web, mail or phone link (https://, mailto:, tel:) or a relative path.")}
            onSubmit={(values) => run(setLink(values.href ?? ""))}
            {...(link ? { onRemove: () => run(removeLink) } : {})}
            trigger={
              <Toolbar.Button aria-label="Link" title="Link (Ctrl+K)" aria-keyshortcuts="Control+K" aria-pressed={Boolean(link)} className={tool}>
                <LinkIcon aria-hidden="true" />
              </Toolbar.Button>
            }
          />
          {commentsEnabled && (
            <Popover.Root
              open={commentOpen}
              onOpenChange={(next) => {
                setCommentOpen(next);
                if (next) setDraftComment("");
              }}
            >
              <Popover.Trigger
                render={
                  <Toolbar.Button aria-label="Add comment" disabled={!hasSelection} className={tool}>
                    <MessageSquarePlusIcon aria-hidden="true" />
                  </Toolbar.Button>
                }
              />
              <Popover.Portal container={container}>
                <Popover.Positioner sideOffset={6} className="z-50">
                  <Popover.Popup className={cn(popupSurface, "flex w-72 flex-col gap-2 p-3 text-sm outline-none")}>
                    <Popover.Title className="font-medium">Comment on selection</Popover.Title>
                    <textarea
                      autoFocus
                      aria-label="Comment"
                      rows={3}
                      value={draftComment}
                      onChange={(event) => setDraftComment(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) addComment();
                      }}
                      className={cn("rounded-md border border-input bg-background px-2 py-1", focusRing)}
                    />
                    <button type="button" disabled={!draftComment.trim()} onClick={addComment} className={cn("h-8 self-end rounded-md bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50", focusRing)}>
                      Comment
                    </button>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )}
          {separator}
          <Toolbar.Button aria-label="Bulleted list" aria-pressed={list?.kind === "bullet"} onClick={() => run(toggleList("bullet"))} className={tool}>
            <ListIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Numbered list" aria-pressed={list?.kind === "ordered"} onClick={() => run(toggleList("ordered"))} className={tool}>
            <ListOrderedIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="To-do list" aria-pressed={list?.kind === "task"} onClick={() => run(toggleList("task"))} className={tool}>
            <ListChecksIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Decrease indent" disabled={!list} onClick={() => run(outdentList)} className={tool}>
            <IndentDecreaseIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Increase indent" disabled={!list} onClick={() => run(indentList)} className={tool}>
            <IndentIncreaseIcon aria-hidden="true" />
          </Toolbar.Button>
          {separator}
          {(["left", "center", "right"] as const).map((item) => (
            <Toolbar.Button key={item} aria-label={`Align ${item}`} aria-pressed={align === item} onClick={() => run(setAlign(item))} className={tool}>
              {item === "left" ? <AlignLeftIcon aria-hidden="true" /> : item === "center" ? <AlignCenterIcon aria-hidden="true" /> : <AlignRightIcon aria-hidden="true" />}
            </Toolbar.Button>
          ))}
          {separator}
          <Toolbar.Button aria-label="Insert table" onClick={() => run(insertTable(3, 3))} className={tool}>
            <Table2Icon aria-hidden="true" />
          </Toolbar.Button>
          {inTable && <TableMenu state={editorState} run={run} />}
          <UrlDialog
            open={imageOpen}
            onOpenChange={setImageOpen}
            title="Insert image"
            submitLabel="Insert"
            fields={[
              { name: "src", label: "Image URL", placeholder: "https://example.com/photo.jpg" },
              { name: "alt", label: "Description (alt text)" },
            ]}
            validate={(values) => (insertImage(values.src ?? "")(editorState) ? null : "Use an https:// image address or a data:image URI.")}
            onSubmit={(values) => run(insertImage(values.src ?? "", values.alt ?? ""))}
            trigger={
              <Toolbar.Button aria-label="Insert image" className={tool}>
                <ImageIcon aria-hidden="true" />
              </Toolbar.Button>
            }
          />
          <Toolbar.Button aria-label="Insert divider" onClick={() => run(insertHorizontalRule)} className={tool}>
            <MinusIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Clear formatting" onClick={() => run(clearFormatting)} className={tool}>
            <RemoveFormattingIcon aria-hidden="true" />
          </Toolbar.Button>
          {separator}
          <Toolbar.Button aria-label="Find and replace" title="Find and replace (Ctrl+F)" aria-keyshortcuts="Control+F" aria-pressed={finder.open} onClick={() => (finder.open ? finder.close() : finder.show())} className={tool}>
            <SearchIcon aria-hidden="true" />
          </Toolbar.Button>
          <ActionMenu
            trigger={
              <Toolbar.Button aria-label="Export" className={tool}>
                <DownloadIcon aria-hidden="true" />
              </Toolbar.Button>
            }
            items={[
              { id: "md", label: "Markdown (.md)", onSelect: () => exportAs("md") },
              { id: "html", label: "Web page (.html)", onSelect: () => exportAs("html") },
              { id: "doc", label: "Word (.doc)", onSelect: () => exportAs("doc") },
              { type: "separator", id: "s" },
              { id: "copy", label: "Copy as Markdown", onSelect: () => void navigator.clipboard?.writeText(docToMarkdown(getDoc())).catch(() => undefined) },
              { id: "print", label: "Print or save as PDF", onSelect: () => printHtml(title, docToHtml(getDoc())) },
            ]}
          />
          {toolbarActions && <div className="ml-auto flex items-center gap-1">{toolbarActions}</div>}
        </Toolbar.Root>
      )}
      <FindBar open={finder.open} onClose={finder.close} viewRef={viewRef} state={editorState} readOnly={readOnly} inputRef={finder.inputRef} />
      <div className="flex min-h-0 flex-1">
        <div ref={surfaceRef} className="relative min-w-0 flex-1 overflow-y-auto" style={{ height }}>
          <div ref={mountRef} />
          {slashPosition && slashItems.length > 0 && (
            <ul
              id={`${id}-slash`}
              role="listbox"
              aria-label="Insert block"
              className={cn(popupSurface, "absolute z-30 flex max-h-72 w-64 flex-col overflow-y-auto p-1 text-sm")}
              style={{ left: Math.max(4, slashPosition.left), top: slashPosition.top }}
            >
              {slashItems.map((item, index) => (
                <li
                  key={item.id}
                  id={`${id}-slash-${index}`}
                  role="option"
                  aria-selected={index === Math.min(slash!.index, slashItems.length - 1)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    if (viewRef.current) runSlashCommand(viewRef.current, item);
                  }}
                  className="flex cursor-default flex-col rounded-md px-2 py-1.5 aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {commentsEnabled && showComments && (
          <aside aria-label="Comments" className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto border-l border-border bg-muted/30 p-2 text-sm" style={{ height }}>
            <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Comments <span className="tabular-nums">{orderedComments.length}</span>
            </h3>
            {orderedComments.length === 0 && <p className="px-1 text-muted-foreground">Select text and add a comment.</p>}
            {orderedComments.map((comment) => {
              const range = ranges.get(comment.id)?.[0];
              const quote = range ? editorState.doc.textBetween(range.from, range.to, " ", " ") : null;
              return (
                <article key={comment.id} aria-label={`Comment by ${comment.author ?? "someone"}`} data-active={activeComment === comment.id || undefined} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2 data-[active]:border-warning">
                  <button type="button" onClick={() => selectComment(comment.id)} disabled={!range} className={cn("truncate rounded border-l-2 border-warning pl-2 text-left text-xs text-muted-foreground disabled:cursor-default", focusRing)}>
                    {quote ?? "The commented text was deleted"}
                  </button>
                  <p className="text-xs font-medium">{comment.author ?? "Comment"}</p>
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                  {comment.replies?.map((item) => (
                    <div key={item.id} className="border-l border-border pl-2">
                      <p className="text-xs font-medium">{item.author ?? "Reply"}</p>
                      <p className="whitespace-pre-wrap">{item.body}</p>
                    </div>
                  ))}
                  {onCommentsChange && (
                    <>
                      <input
                        aria-label="Reply"
                        placeholder="Reply"
                        value={replyDrafts[comment.id] ?? ""}
                        onChange={(event) => setReplyDrafts({ ...replyDrafts, [comment.id]: event.target.value })}
                        onKeyDown={(event) => event.key === "Enter" && reply(comment.id)}
                        className={cn("h-7 rounded-md border border-input bg-background px-2 text-xs", focusRing)}
                      />
                      <div className="flex justify-end gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            removeCommentMarks(comment.id);
                            onCommentsChange((comments ?? []).filter((item) => item.id !== comment.id));
                          }}
                          className={cn("h-7 rounded-md px-2 text-destructive hover:bg-destructive/10", focusRing)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeCommentMarks(comment.id);
                            onCommentsChange((comments ?? []).map((item) => (item.id === comment.id ? { ...item, resolved: true } : item)));
                          }}
                          className={cn("h-7 rounded-md px-2 hover:bg-accent", focusRing)}
                        >
                          Resolve
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </aside>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-border px-3 py-1 text-xs text-muted-foreground tabular-nums">
        <span>
          {counts.words} {counts.words === 1 ? "word" : "words"}
        </span>
        <span>
          {counts.characters} {counts.characters === 1 ? "character" : "characters"}
        </span>
        <span>{Math.max(1, Math.round(counts.words / 230))} min read</span>
        {commentsEnabled && (
          <button type="button" aria-pressed={showComments} onClick={() => setShowComments(!showComments)} className={cn("ml-auto rounded px-1 hover:text-foreground", focusRing)}>
            {showComments ? "Hide comments" : `Show comments (${openComments.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
