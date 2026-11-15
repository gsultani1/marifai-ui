// packages/ai-ui/src/components/html-editor-document.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { AsteriskIcon, FileTextIcon, PanelsTopBottomIcon, SeparatorHorizontalIcon, TableOfContentsIcon } from "lucide-react";
import { undoDepth } from "prosemirror-history";
import type { EditorView } from "prosemirror-view";
import { type RefObject, useEffect, useId, useRef, useState } from "react";

import { button, buttonVariants, focusRing, input, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { MAX_FOOTNOTE_LENGTH } from "../lib/rich-text/html.js";
import {
  closeFootnote,
  createDocumentFeature,
  DEFAULT_PAGE_FOOTER,
  type DocumentSettings,
  documentKey,
  EDIT_HEADER_FOOTER_EVENT,
  type FootnoteEditing,
  fillPageTemplate,
  formatPageDate,
  insertFootnote,
  insertPageBreak,
  insertTableOfContents,
  PAGE_SIZES,
  pageAt,
  pagePrintStyles,
} from "../lib/rich-text/html-document.js";
import { usePortalContainer } from "../lib/portal.js";
import { ActionMenu } from "./action-menu.js";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog.js";
import type { HtmlEditorExtension, HtmlEditorExtensionSetup, HtmlEditorRenderProps } from "./html-editor-extension.js";
import type { HtmlEditorViewProps } from "./html-editor-view.js";
import { editorTool, ToolbarSeparator } from "./rich-text-parts.js";

function settingsFrom(props: HtmlEditorViewProps): DocumentSettings {
  return {
    enabled: !props.compact,
    readOnly: Boolean(props.readOnly),
    layout: props.layout ?? props.defaultLayout ?? "web",
    pageSize: props.pageSize ?? "letter",
    header: props.header ?? props.defaultHeader ?? "",
    footer: props.footer ?? props.defaultFooter ?? DEFAULT_PAGE_FOOTER,
    title: props.title ?? "Document",
  };
}

/**
 * Print CSS for HtmlEditor's page layout: `@page` rules with the paper size
 * and one inch margins, and the header and footer in the top and bottom
 * margin boxes with {page} and {pages} as page counters. Pass it with
 * HTML_CONTENT_CSS when printing or exporting a paged document.
 */
export function pagePrintCss(props: HtmlEditorViewProps): string {
  const { pageSize, header, footer, title } = settingsFrom(props);
  return pagePrintStyles({ pageSize, header, footer, title });
}

const TOKENS = [
  { value: "{page}", label: "Page number" },
  { value: "{pages}", label: "Page count" },
  { value: "{title}", label: "Title" },
  { value: "{date}", label: "Today's date" },
] as const;

type TemplateField = "header" | "footer";

function HeaderFooterForm({ props, pages, onDone }: { props: HtmlEditorViewProps; pages: number; onDone: (changed: boolean) => void }) {
  const [values, setValues] = useState<Record<TemplateField, string>>(() => ({ header: props.header ?? "", footer: props.footer ?? DEFAULT_PAGE_FOOTER }));
  const [target, setTarget] = useState<TemplateField>("header");
  const headerRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const date = formatPageDate();
  const title = props.title ?? "Document";

  const insertToken = (token: string) => {
    const field = target === "header" ? headerRef.current : footerRef.current;
    const value = values[target];
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    setValues({ ...values, [target]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const changed = values.header !== (props.header ?? "") || values.footer !== (props.footer ?? DEFAULT_PAGE_FOOTER);
        if (values.header !== props.header) props.onHeaderChange?.(values.header);
        if (values.footer !== props.footer) props.onFooterChange?.(values.footer);
        onDone(changed);
      }}
    >
      <DialogHeader>
        <DialogTitle>Header and footer</DialogTitle>
        <DialogDescription>Shown at the top and bottom of every page in page layout and when printing.</DialogDescription>
      </DialogHeader>
      {(["header", "footer"] as const).map((name) => (
        <div key={name} className="flex flex-col gap-1.5 text-sm">
          <label htmlFor={`${id}-${name}`} className="font-medium">
            {name === "header" ? "Header" : "Footer"}
          </label>
          <input
            id={`${id}-${name}`}
            ref={name === "header" ? headerRef : footerRef}
            value={values[name]}
            maxLength={300}
            autoComplete="off"
            aria-describedby={`${id}-${name}-preview ${id}-fields`}
            onFocus={() => setTarget(name)}
            onChange={(event) => setValues({ ...values, [name]: event.target.value })}
            className={cn(input, focusRing)}
          />
          <span id={`${id}-${name}-preview`} className="truncate text-xs text-muted-foreground">
            Page 1 shows: {fillPageTemplate(values[name], { page: 1, pages, title, date }) || "nothing"}
          </span>
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-fields`} className="text-xs text-muted-foreground">
          Fields fill in on each page. Choose one to add it to the {target} at the cursor.
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TOKENS.map((token) => (
            <button key={token.value} type="button" onClick={() => insertToken(token.value)} className={cn(button, buttonVariants.outline, "h-7 gap-1 px-2 text-xs font-normal", focusRing)}>
              <span className="font-mono">{token.value}</span>
              <span className="text-muted-foreground">{token.label}</span>
            </button>
          ))}
        </div>
      </div>
      <DialogFooter>
        <DialogClose className={cn(button, buttonVariants.outline, focusRing)}>Cancel</DialogClose>
        <button type="submit" className={cn(button, buttonVariants.primary, focusRing)}>
          Save
        </button>
      </DialogFooter>
    </form>
  );
}

function DocumentToolbar({ state, run, locked, props, surfaceRef, setStatus }: HtmlEditorRenderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const paged = props.layout === "page";
  const document = documentKey.getState(state);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const open = () => setDialogOpen(true);
    surface.addEventListener(EDIT_HEADER_FOOTER_EVENT, open);
    return () => surface.removeEventListener(EDIT_HEADER_FOOTER_EVENT, open);
  }, [surfaceRef]);

  return (
    <>
      <ToolbarSeparator />
      <Toolbar.Button aria-label="Page layout" title="Page layout" aria-pressed={paged} disabled={locked} onClick={() => props.onLayoutChange?.(paged ? "web" : "page")} className={editorTool}>
        <FileTextIcon aria-hidden="true" />
      </Toolbar.Button>
      {paged && (
        <>
          <ActionMenu
            trigger={
              <Toolbar.Button disabled={locked} title="Page size" className={cn(editorTool, "w-auto px-2 text-xs text-foreground")}>
                <span className="sr-only">Page size: </span>
                {PAGE_SIZES[props.pageSize ?? "letter"].label}
              </Toolbar.Button>
            }
            items={(["letter", "a4"] as const).map((size) => ({
              id: size,
              label: PAGE_SIZES[size].label,
              checked: (props.pageSize ?? "letter") === size,
              onSelect: () => {
                props.onPageSizeChange?.(size);
                setStatus(`Page size ${PAGE_SIZES[size].label}`);
              },
            }))}
          />
          <Toolbar.Button aria-label="Header and footer" title="Header and footer" aria-haspopup="dialog" disabled={locked} onClick={() => setDialogOpen(true)} className={editorTool}>
            <PanelsTopBottomIcon aria-hidden="true" />
          </Toolbar.Button>
        </>
      )}
      <Toolbar.Button aria-label="Insert footnote" title="Insert footnote (Ctrl+Alt+F)" aria-keyshortcuts="Control+Alt+F" disabled={locked || !insertFootnote(state)} onClick={() => run(insertFootnote)} className={editorTool}>
        <AsteriskIcon aria-hidden="true" />
      </Toolbar.Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <HeaderFooterForm
            props={props}
            pages={(document?.breaks.length ?? 0) + 1}
            onDone={(changed) => {
              setDialogOpen(false);
              if (changed) setStatus("Header and footer updated");
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface FootnoteEditorProps {
  editing: FootnoteEditing;
  number: number;
  initialText: string;
  depthAtOpen: number;
  viewRef: RefObject<EditorView | null>;
  setStatus: (message: string) => void;
}

function FootnoteEditor({ editing, number, initialText, depthAtOpen, viewRef, setStatus }: FootnoteEditorProps) {
  const container = usePortalContainer();
  const [text, setText] = useState(initialText);
  const [depth] = useState(depthAtOpen);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closed = useRef(false);
  const label = number > 0 ? `Footnote ${number}` : "Footnote";
  const listItem = (view: EditorView) => view.dom.querySelector<HTMLElement>(`[data-footnote-item="${number}"]`);

  const close = (action: "save" | "cancel" | "delete", refocus: boolean) => {
    const view = viewRef.current;
    if (!view || closed.current) return;
    closed.current = true;
    const toList = refocus && editing.source === "list";
    const result = closeFootnote(view, { action, text, refocus: refocus && !toList, ...(editing.fresh ? { undoDepth: depth } : {}) });
    if (toList) requestAnimationFrame(() => (listItem(view) ?? view.dom).focus());
    if (result === "removed") setStatus(`${label} removed`);
    else if (result === "saved") setStatus(`${label} saved`);
  };

  const anchor = (): Element | null => {
    const view = viewRef.current;
    if (!view) return null;
    if (editing.source === "list") {
      const item = listItem(view);
      if (item) return item;
    }
    const pos = documentKey.getState(view.state)?.editing?.pos ?? editing.pos;
    const dom = view.nodeDOM(pos);
    return dom instanceof Element ? dom : null;
  };

  return (
    <Popover.Root
      open
      onOpenChange={(open, details) => {
        if (!open) close(details.reason === "escape-key" ? "cancel" : "save", details.reason === "escape-key");
      }}
    >
      <Popover.Portal container={container}>
        <Popover.Positioner anchor={anchor} side="bottom" sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup initialFocus={textareaRef} finalFocus={false} className={cn(popupSurface, "w-80 max-w-[calc(100vw-2rem)] p-3 text-sm outline-none")}>
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                close("save", true);
              }}
            >
              <Popover.Title className="font-medium">{label}</Popover.Title>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Footnote text</span>
                <textarea
                  ref={textareaRef}
                  value={text}
                  rows={3}
                  maxLength={MAX_FOOTNOTE_LENGTH}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      close("save", true);
                    }
                  }}
                  className={cn("min-h-16 resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground", focusRing)}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => close("delete", true)} className={cn(button, "mr-auto px-2 text-destructive hover:bg-destructive/10", focusRing)}>
                  Delete
                </button>
                <button type="button" onClick={() => close("cancel", true)} className={cn(button, buttonVariants.outline, focusRing)}>
                  Cancel
                </button>
                <button type="submit" className={cn(button, buttonVariants.primary, focusRing)}>
                  Save
                </button>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FootnoteOverlay({ state, viewRef, readOnly, locked, setStatus }: HtmlEditorRenderProps) {
  const document = documentKey.getState(state);
  const editing = document?.editing;
  if (!document || !editing || readOnly || locked) return null;
  const number = document.footnotes.findIndex((entry) => entry.pos === editing.pos) + 1;
  const initialText = (state.doc.nodeAt(editing.pos)?.attrs.text as string | undefined) ?? "";
  return <FootnoteEditor key={editing.serial} editing={editing} number={number} initialText={initialText} depthAtOpen={undoDepth(state)} viewRef={viewRef} setStatus={setStatus} />;
}

function PageStatus({ state }: HtmlEditorRenderProps) {
  const document = documentKey.getState(state);
  if (!document?.paged) return null;
  const page = pageAt(
    document.breaks.map((at) => at.pos),
    state.selection.head,
  );
  return (
    <span>
      Page {page} of {document.breaks.length + 1}
    </span>
  );
}

/** Word-style documents: page layout with headers, footers and page numbers, page breaks, the table of contents and footnotes. */
export function createDocumentExtension(setup: HtmlEditorExtensionSetup): HtmlEditorExtension {
  const { plugins, nodeViews } = createDocumentFeature({ getSettings: () => settingsFrom(setup.getProps()), announce: setup.setStatus });
  const runIn = (view: EditorView, command: typeof insertPageBreak) => {
    command(view.state, view.dispatch, view);
    view.focus();
  };
  return {
    name: "document",
    plugins,
    nodeViews,
    slashItems: [
      {
        id: "page-break",
        label: "Page break",
        description: "Start a new page (Ctrl+Enter)",
        keywords: ["break", "new page", "pagebreak"],
        icon: <SeparatorHorizontalIcon aria-hidden="true" />,
        group: "Document",
        run: (view) => runIn(view, insertPageBreak),
      },
      {
        id: "table-of-contents",
        label: "Table of contents",
        description: "A list of headings that stays up to date",
        keywords: ["toc", "contents", "outline", "index"],
        icon: <TableOfContentsIcon aria-hidden="true" />,
        group: "Document",
        run: (view) => runIn(view, insertTableOfContents),
      },
      {
        id: "footnote",
        label: "Footnote",
        description: "A numbered note listed at the end (Ctrl+Alt+F)",
        keywords: ["note", "reference", "citation", "endnote", "source"],
        icon: <AsteriskIcon aria-hidden="true" />,
        group: "Document",
        run: (view) => runIn(view, insertFootnote),
      },
    ],
    surfaceClassName: (props) => (props.layout === "page" && !props.compact ? "bg-muted [scrollbar-gutter:stable]" : undefined),
    Toolbar: DocumentToolbar,
    Overlay: FootnoteOverlay,
    Status: PageStatus,
  };
}
