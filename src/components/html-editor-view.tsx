// packages/ai-ui/src/components/html-editor-view.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BaselineIcon,
  BoldIcon,
  CodeXmlIcon,
  DownloadIcon,
  HighlighterIcon,
  ImageIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  SearchIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  Table2Icon,
  UnderlineIcon,
  Undo2Icon,
  UploadIcon,
  VideoIcon,
} from "lucide-react";
import { toggleMark } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { history, redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, type NodeSelection, TextSelection } from "prosemirror-state";
import { isInTable, tableEditing } from "prosemirror-tables";
import type { EditorView, NodeView } from "prosemirror-view";
import { type ReactElement, type ReactNode, type Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText } from "../lib/download.js";
import { buildKeymaps, clearFormatting, currentAlign, currentBlock, currentList, insertHorizontalRule, insertTable, linkRange, removeLink, setAlign, setBlock, setLink, type TextAlign, toggleList } from "../lib/rich-text/commands.js";
import { canOutdent, changeIndent, currentStyleMark, insertBlockNode, insertEmbed, placeImage, selectedImage, setStyleMark, type StyleMarkName } from "../lib/rich-text/html-commands.js";
import { DEFAULT_HTML_COLORS, DEFAULT_HTML_FONT_SIZES, DEFAULT_HTML_FONTS, type HtmlFontOption } from "../lib/rich-text/html-options.js";
import { cleanPastedHtml, docToHtml, embedFromUrl, formatHtml, HTML_CONTENT_CSS, htmlSchema, htmlToDoc, primaryFontFamily } from "../lib/rich-text/html.js";
import { findPlugin, placeholderPlugin, RICH_TEXT_EVENTS, selectionSyncPlugin } from "../lib/rich-text/plugins.js";
import { usePortalContainer } from "../lib/portal.js";
import { safeImageSrc } from "../lib/safe-url.js";
import { ActionMenu } from "./action-menu.js";
import { CodeEditor } from "./code-editor.js";
import { ColorPickerPanel } from "./color-picker.js";
import { createAiExtension } from "./html-editor-ai.js";
import { createBlocksExtension } from "./html-editor-blocks.js";
import { createDocumentExtension, pagePrintCss } from "./html-editor-document.js";
import { HTML_EDITOR_PROPS_META, type HtmlAiAction, type HtmlAiHandler, type HtmlEditorExtension, type HtmlEditorRenderProps } from "./html-editor-extension.js";
import { createMediaExtension } from "./html-editor-media.js";
import { createReviewExtension } from "./html-editor-review.js";
import type { RichTextComment } from "./rich-text-editor-view.js";
import { BLOCK_LABELS, docCounts, docText, EDITOR_CONTENT_CLASS, editorTool, FindBar, MarkButton, printHtml, standaloneHtml, TableMenu, ToolbarSeparator, UrlDialog, useFindToggle, useProseEditor } from "./rich-text-parts.js";

export interface HtmlEditorHandle {
  focus: () => void;
  getHTML: () => string;
  /** Replaces the document; undo history keeps the change. */
  setHTML: (html: string) => void;
  getText: () => string;
  insertText: (text: string) => void;
  /** The ProseMirror view, or null before mount. */
  getView: () => EditorView | null;
}

export interface HtmlEditorViewProps {
  /** HTML content; when it changes from outside, the document is replaced. */
  value?: string;
  defaultValue?: string;
  /** Called with sanitized HTML after every change; an empty document gives "". */
  onValueChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Font menu entries. */
  fonts?: HtmlFontOption[];
  /** Font size menu entries in pixels. */
  fontSizes?: number[];
  /** Swatches in the text and highlight color menus. */
  colors?: string[];
  /**
   * Keeps fonts, sizes and colors when pasting from Word, Google Docs or web
   * pages. Structure, bold, italic, links, lists and tables are always kept.
   */
  pasteStyles?: boolean;
  /** Shows the HTML source button. */
  sourceView?: boolean;
  /**
   * Text formatting only: hides tables, images, video, dividers, find,
   * source and export, for narrow panels such as PageBuilder's text blocks.
   */
  compact?: boolean;
  /**
   * Uploads an image file chosen, pasted or dropped into the editor and
   * resolves to its URL. Without it, images are added by URL only.
   */
  onImageUpload?: (file: File) => Promise<string>;
  /**
   * "page" shows the content on a white page in both themes, so chosen
   * colors look as they will when published; "theme" follows the app theme.
   */
  surface?: "page" | "theme";
  /** File name without extension for downloads. */
  title?: string;
  /** Extra controls at the end of the toolbar. */
  toolbarActions?: ReactNode;
  /** Typing "/" opens a menu of blocks to insert. On by default unless `compact`. */
  slashMenu?: boolean;
  /** A formatting toolbar floats over selected text. On by default unless `compact`. */
  bubbleToolbar?: boolean;
  /** Hovering a block shows a handle to drag it or open its menu. On by default unless `compact`. */
  blockHandles?: boolean;
  /** "page" lays the document out on pages with a header, footer and page numbers; "web" is one continuous column. */
  layout?: "web" | "page";
  defaultLayout?: "web" | "page";
  onLayoutChange?: (layout: "web" | "page") => void;
  /** Paper size in page layout and print. */
  pageSize?: "letter" | "a4";
  defaultPageSize?: "letter" | "a4";
  onPageSizeChange?: (pageSize: "letter" | "a4") => void;
  /** Text at the top of every page in page layout and print; {page}, {pages}, {title} and {date} are filled in. */
  header?: string;
  defaultHeader?: string;
  onHeaderChange?: (header: string) => void;
  /** Text at the bottom of every page; defaults to "Page {page} of {pages}". */
  footer?: string;
  defaultFooter?: string;
  onFooterChange?: (footer: string) => void;
  /** Comment threads anchored in the document. Supplying this turns on commenting and the comments panel. */
  comments?: RichTextComment[];
  onCommentsChange?: (comments: RichTextComment[]) => void;
  /** Name stored on comments, replies and tracked changes. */
  author?: string;
  /** Shows the track changes switch and the list of changes. */
  review?: boolean;
  /** Records edits as suggestions to accept or reject instead of changing the text. */
  trackChanges?: boolean;
  defaultTrackChanges?: boolean;
  onTrackChangesChange?: (on: boolean) => void;
  /** Turns on AI writing (the AI menu, Ctrl+J and the selection toolbar button) with your model behind it. */
  onAiRequest?: HtmlAiHandler;
  /** Replaces the AI menu's presets. */
  aiActions?: readonly HtmlAiAction[];
  className?: string;
  /** Height of the scrolling document area. */
  height?: number | string;
  "aria-label"?: string;
  ref?: Ref<HtmlEditorHandle>;
}

const CONTENT_CLASS = cn(
  EDITOR_CONTENT_CLASS,
  "[&_.html-embed]:my-3 [&_.html-embed]:flex [&_.html-embed]:aspect-video [&_.html-embed]:max-w-xl [&_.html-embed]:flex-col [&_.html-embed]:items-center [&_.html-embed]:justify-center [&_.html-embed]:gap-1 [&_.html-embed]:rounded-lg [&_.html-embed]:border [&_.html-embed]:border-border [&_.html-embed]:bg-muted [&_.html-embed]:text-sm [&_.html-embed]:whitespace-normal [&_.html-embed]:text-muted-foreground [&_.html-embed.ProseMirror-selectednode]:outline-2 [&_.html-embed.ProseMirror-selectednode]:outline-primary",
  "[&_.html-embed-play]:flex [&_.html-embed-play]:size-10 [&_.html-embed-play]:items-center [&_.html-embed-play]:justify-center [&_.html-embed-play]:rounded-full [&_.html-embed-play]:bg-foreground [&_.html-embed-play]:text-background",
);

/** Editing stand-in for an embed: it names the player and link instead of loading third-party content while you write. */
function embedView(node: ProseMirrorNode): NodeView {
  const dom = document.createElement("div");
  dom.className = "html-embed";
  dom.dataset.embed = node.attrs.kind as string;
  const play = document.createElement("span");
  play.className = "html-embed-play";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";
  const label = document.createElement("span");
  label.className = "font-medium text-foreground";
  label.textContent = (node.attrs.title as string) || `${node.attrs.provider as string} video`;
  const source = document.createElement("span");
  source.className = "max-w-full truncate px-4 text-xs";
  source.textContent = node.attrs.src as string;
  dom.append(play, label, source);
  return { dom, ignoreMutation: () => true };
}

function ColorMenu({ label, icon, value, colors, disabled, onPick, onClear }: { label: string; icon: ReactElement; value: string | null; colors: string[]; disabled: boolean; onPick: (hex: string) => void; onClear: () => void }) {
  const container = usePortalContainer();
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Toolbar.Button aria-label={label} title={label} disabled={disabled} className={cn(editorTool, "relative")}>
            {icon}
            <span aria-hidden="true" className="absolute inset-x-2 bottom-1 h-0.5 rounded-full border border-border" style={{ background: value ?? "transparent" }} />
          </Toolbar.Button>
        }
      />
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className={cn(popupSurface, "flex flex-col gap-2 p-3 text-sm outline-none")}>
            <Popover.Title className="font-medium">{label}</Popover.Title>
            <ColorPickerPanel value={value ?? "#000000"} onValueChange={onPick} swatches={colors} swatchesLabel="Colors" />
            <button type="button" disabled={!value} onClick={onClear} className={cn("h-8 rounded-md border border-input px-3 hover:bg-accent disabled:opacity-50", focusRing)}>
              Remove color
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const ALIGN_ICONS: Record<TextAlign, ReactNode> = {
  left: <AlignLeftIcon aria-hidden="true" />,
  center: <AlignCenterIcon aria-hidden="true" />,
  right: <AlignRightIcon aria-hidden="true" />,
  justify: <AlignJustifyIcon aria-hidden="true" />,
};

/**
 * WYSIWYG HTML editor on ProseMirror for CMS pages, product descriptions
 * and email bodies: fonts, sizes, text and highlight colors, alignment and
 * indents, lists, tables, links, images (by URL or upload), YouTube, Vimeo
 * and Loom embeds, find and replace, an HTML source view, cleanup of
 * content pasted from Word and Google Docs, and export. Content goes in
 * and out as HTML that has been through htmlSchema's allowlists.
 */
export function HtmlEditorView(viewProps: HtmlEditorViewProps) {
  const {
    value,
    defaultValue = "",
    onValueChange,
    readOnly = false,
    placeholder = "Start writing",
    autoFocus = false,
    fonts = DEFAULT_HTML_FONTS,
    fontSizes = DEFAULT_HTML_FONT_SIZES,
    colors = DEFAULT_HTML_COLORS,
    pasteStyles = false,
    sourceView = true,
    compact = false,
    onImageUpload,
    surface = "page",
    title = "Document",
    toolbarActions,
    className,
    height = "28rem",
    "aria-label": ariaLabel = "Document",
    ref,
  } = viewProps;
  const viewRef = useRef<EditorView | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useControllableState({ value: viewProps.layout, defaultValue: viewProps.defaultLayout ?? "web", onChange: viewProps.onLayoutChange });
  const [header, setHeader] = useControllableState({ value: viewProps.header, defaultValue: viewProps.defaultHeader ?? "", onChange: viewProps.onHeaderChange });
  const [footer, setFooter] = useControllableState({ value: viewProps.footer, defaultValue: viewProps.defaultFooter ?? "Page {page} of {pages}", onChange: viewProps.onFooterChange });
  const [pageSize, setPageSize] = useControllableState({ value: viewProps.pageSize, defaultValue: viewProps.defaultPageSize ?? "letter", onChange: viewProps.onPageSizeChange });
  const [trackChanges, setTrackChanges] = useControllableState({ value: viewProps.trackChanges, defaultValue: viewProps.defaultTrackChanges ?? false, onChange: viewProps.onTrackChangesChange });
  /** Props as extensions see them: defaults applied and state that may be uncontrolled resolved, with setters that keep both modes working. */
  const effectiveProps: HtmlEditorViewProps = {
    ...viewProps,
    compact,
    readOnly,
    title,
    layout,
    onLayoutChange: setLayout,
    pageSize,
    onPageSizeChange: setPageSize,
    header,
    onHeaderChange: setHeader,
    footer,
    onFooterChange: setFooter,
    trackChanges,
    onTrackChangesChange: setTrackChanges,
    slashMenu: viewProps.slashMenu ?? !compact,
    bubbleToolbar: viewProps.bubbleToolbar ?? !compact,
    blockHandles: viewProps.blockHandles ?? !compact,
  };
  const propsRef = useRef(effectiveProps);
  const finder = useFindToggle(viewRef);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const appliedSource = useRef<string | null>(null);
  const sourceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const live = useRef({ onImageUpload, pasteStyles });

  useEffect(() => {
    live.current = { onImageUpload, pasteStyles };
  }, [onImageUpload, pasteStyles]);

  useEffect(() => {
    propsRef.current = effectiveProps;
  });

  // Extensions call these getters from plugin callbacks and event handlers only, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [extensions] = useState<HtmlEditorExtension[]>(() => {
    const setup = { getView: () => viewRef.current, getProps: () => propsRef.current, setStatus };
    return [createBlocksExtension(setup), createMediaExtension(setup), createDocumentExtension(setup), createReviewExtension(setup), createAiExtension(setup)];
  });
  const slashItems = useMemo(() => extensions.flatMap((extension) => extension.slashItems ?? []), [extensions]);

  useEffect(() => () => clearTimeout(sourceTimer.current), []);

  /** Uploads images and inserts them as figures at `position`; with `replace`, the first one replaces the selected image's source. */
  const uploadImages = async (files: File[], position: number, replace = false) => {
    const upload = live.current.onImageUpload;
    if (!upload) return;
    let at = position;
    let replacing = replace;
    for (const file of files) {
      setStatus(`Uploading ${file.name}…`);
      try {
        const src = safeImageSrc(await upload(file));
        const view = viewRef.current;
        if (!src || !view) throw new Error("unsafe image URL");
        const selected = replacing ? selectedImage(view.state) : null;
        replacing = false;
        if (selected) {
          view.dispatch(view.state.tr.setNodeMarkup(view.state.selection.from, undefined, { ...(view.state.selection as NodeSelection).node.attrs, src }));
          at = view.state.selection.to;
          setStatus(`Replaced the image with ${file.name}`);
          continue;
        }
        at = Math.min(at, view.state.doc.content.size);
        const placed = view.state.apply(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(at))));
        const tr = insertBlockNode(placed, htmlSchema.nodes.figure!.create({ src, alt: file.name.replace(/\.[^.]+$/, "") }));
        view.dispatch(tr);
        at = tr.selection.from;
        setStatus(`Uploaded ${file.name}`);
      } catch {
        setStatus(`Couldn't upload ${file.name}`);
      }
    }
  };

  const imageFiles = (list: FileList | null | undefined) => [...(list ?? [])].filter((file) => file.type.startsWith("image/"));

  const { mountRef, editorState, run, replaceContent, lastValue } = useProseEditor({
    viewRef,
    createState: () =>
      EditorState.create({
        doc: htmlToDoc(value ?? defaultValue),
        plugins: [
          selectionSyncPlugin(),
          ...extensions.flatMap((extension) => extension.plugins ?? []),
          keymap({
            "Mod-]": changeIndent(1),
            "Mod-[": changeIndent(-1),
            "Mod-Shift-l": setAlign("left"),
            "Mod-Shift-e": setAlign("center"),
            "Mod-Shift-r": setAlign("right"),
            "Mod-Shift-j": setAlign("justify"),
            "Mod-.": toggleMark(htmlSchema.marks.superscript!),
            "Mod-,": toggleMark(htmlSchema.marks.subscript!),
          }),
          ...buildKeymaps(htmlSchema),
          history(),
          dropCursor({ color: "var(--primary)", width: 2 }),
          gapCursor(),
          tableEditing(),
          placeholderPlugin(placeholder),
          findPlugin(),
        ],
      }),
    value,
    initialValue: defaultValue,
    parse: htmlToDoc,
    serialize: docToHtml,
    readOnly,
    autoFocus,
    onChange: (html) => onValueChange?.(html),
    viewProps: {
      nodeViews: Object.assign({ embed: (node: ProseMirrorNode) => embedView(node) }, ...extensions.map((extension) => extension.nodeViews ?? {})),
      // tabindex keeps the document reachable by keyboard when read-only, so it can still be scrolled.
      attributes: { role: "textbox", "aria-multiline": "true", "aria-label": ariaLabel, class: CONTENT_CLASS, spellcheck: "true", tabindex: "0" },
      transformPastedHTML: (html) => cleanPastedHtml(html, { keepStyles: live.current.pasteStyles }),
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length || !live.current.onImageUpload) return false;
        event.preventDefault();
        void uploadImages(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length || !live.current.onImageUpload) return false;
        event.preventDefault();
        void uploadImages(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from);
        return true;
      },
    },
    events: [
      [RICH_TEXT_EVENTS.openLink, () => setLinkOpen(true)],
      [RICH_TEXT_EVENTS.openFind, () => finder.show()],
      [RICH_TEXT_EVENTS.openImage, () => setImageOpen(true)],
      [RICH_TEXT_EVENTS.openVideo, () => setVideoOpen(true)],
    ],
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      getHTML: () => (viewRef.current ? docToHtml(viewRef.current.state.doc) : lastValue.current),
      setHTML: replaceContent,
      getText: () => (viewRef.current ? docText(viewRef.current.state.doc) : ""),
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

  const propsKey = JSON.stringify([layout, pageSize, header, footer, title, trackChanges, readOnly, compact, viewProps.review ?? false, viewProps.comments ?? null]);
  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta(HTML_EDITOR_PROPS_META, true));
  }, [propsKey]);

  /* ---------------- source view ---------------- */

  const applySource = (html: string) => {
    if (html === appliedSource.current) return;
    appliedSource.current = html;
    replaceContent(html);
  };

  const editSource = (html: string) => {
    setSource(html);
    clearTimeout(sourceTimer.current);
    sourceTimer.current = setTimeout(() => applySource(html), 400);
  };

  const toggleSource = () => {
    const view = viewRef.current;
    if (!view) return;
    if (source === null) {
      const formatted = formatHtml(docToHtml(view.state.doc));
      appliedSource.current = formatted;
      setSource(formatted);
      return;
    }
    clearTimeout(sourceTimer.current);
    applySource(source);
    setSource(null);
    requestAnimationFrame(() => viewRef.current?.focus());
  };

  /* ---------------- derived state ---------------- */

  const marks = htmlSchema.marks;
  const locked = source !== null;
  const block = currentBlock(editorState);
  const list = currentList(editorState);
  const align = currentAlign(editorState);
  const inTable = isInTable(editorState);
  const link = linkRange(editorState);
  const image = selectedImage(editorState);
  const font = currentStyleMark(editorState, "font_family");
  const size = currentStyleMark(editorState, "font_size");
  const textColor = currentStyleMark(editorState, "text_color");
  const highlight = currentStyleMark(editorState, "background_color");
  const counts = useMemo(() => docCounts(editorState.doc), [editorState.doc]);
  const fontLabel = font ? (fonts.find((option) => option.value === font || primaryFontFamily(option.value) === primaryFontFamily(font))?.label ?? font.split(",")[0]!.replace(/["']/g, "")) : "Default";

  const applyStyle = (name: StyleMarkName, next: string | null) => {
    const view = viewRef.current;
    if (view) setStyleMark(name, next)(view.state, view.dispatch);
  };

  const getDoc = () => viewRef.current?.state.doc ?? editorState.doc;
  /** Content styles, plus paper, margins, header and footer in page layout. */
  const exportCss = () => (layout === "page" ? HTML_CONTENT_CSS + pagePrintCss(effectiveProps) : HTML_CONTENT_CSS);
  const exportAs = (format: "html" | "doc") => {
    const html = standaloneHtml(title, docToHtml(getDoc()), exportCss());
    if (format === "html") downloadText(`${title}.html`, html, "text/html;charset=utf-8");
    else downloadText(`${title}.doc`, `\uFEFF${html}`, "application/msword");
  };

  /* ---------------- render ---------------- */

  const baseRenderProps: Omit<HtmlEditorRenderProps, "bubbleItems"> = { state: editorState, viewRef, run, readOnly, locked, props: effectiveProps, surfaceRef, setStatus, slashItems };
  const bubbleItems = compact ? null : extensions.map((extension) => extension.Bubble && <extension.Bubble key={extension.name} {...baseRenderProps} bubbleItems={null} />);
  const renderProps: HtmlEditorRenderProps = { ...baseRenderProps, bubbleItems };
  const slot = (part: "Toolbar" | "Overlay" | "Aside" | "Status") =>
    compact
      ? null
      : extensions.map((extension) => {
          const Part = extension[part];
          return Part ? <Part key={extension.name} {...renderProps} /> : null;
        });

  const tool = editorTool;
  const separator = <ToolbarSeparator />;
  const markButton = (label: string, name: keyof typeof marks, icon: ReactNode, shortcut?: string) => <MarkButton label={label} type={marks[name]!} icon={icon} {...(shortcut ? { shortcut } : {})} state={editorState} run={run} disabled={locked} />;

  return (
    <div data-slot="html-editor" className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground", className)}>
      {!readOnly && (
        <Toolbar.Root aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
          <Toolbar.Button aria-label="Undo" disabled={locked || undoDepth(editorState) === 0} onClick={() => run(undo)} className={tool}>
            <Undo2Icon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Redo" disabled={locked || redoDepth(editorState) === 0} onClick={() => run(redo)} className={tool}>
            <Redo2Icon aria-hidden="true" />
          </Toolbar.Button>
          {separator}
          <ActionMenu
            trigger={
              <Toolbar.Button disabled={locked} className={cn(tool, "w-28 justify-between px-2 text-sm text-foreground")}>
                <span className="sr-only">Block type: </span>
                {BLOCK_LABELS.find((item) => item.kind === block)?.label ?? "Text"}
              </Toolbar.Button>
            }
            items={BLOCK_LABELS.map((item) => ({ id: item.kind, label: item.label, ...(item.shortcut ? { shortcut: item.shortcut } : {}), checked: block === item.kind, onSelect: () => run(setBlock(item.kind)) }))}
          />
          <ActionMenu
            trigger={
              <Toolbar.Button disabled={locked} className={cn(tool, "w-32 justify-start px-2 text-sm text-foreground")}>
                <span className="sr-only">Font: </span>
                <span className="truncate">{fontLabel}</span>
              </Toolbar.Button>
            }
            items={[
              { id: "default", label: "Default font", checked: !font, onSelect: () => run(setStyleMark("font_family", null)) },
              ...fonts.map((option) => ({ id: `font-${option.label}`, label: <span style={{ fontFamily: option.value }}>{option.label}</span>, checked: option.label === fontLabel && Boolean(font), onSelect: () => run(setStyleMark("font_family", option.value)) })),
            ]}
          />
          <ActionMenu
            trigger={
              <Toolbar.Button disabled={locked} className={cn(tool, "w-16 justify-start px-2 text-sm text-foreground tabular-nums")}>
                <span className="sr-only">Font size: </span>
                {size ? Number.parseInt(size, 10) : "Size"}
              </Toolbar.Button>
            }
            items={[
              { id: "default", label: "Default size", checked: !size, onSelect: () => run(setStyleMark("font_size", null)) },
              ...fontSizes.map((px) => ({ id: `size-${px}`, label: `${px} px`, checked: size === `${px}px`, onSelect: () => run(setStyleMark("font_size", `${px}px`)) })),
            ]}
          />
          {separator}
          {markButton("Bold", "strong", <BoldIcon aria-hidden="true" />, "Ctrl+B")}
          {markButton("Italic", "em", <ItalicIcon aria-hidden="true" />, "Ctrl+I")}
          {markButton("Underline", "underline", <UnderlineIcon aria-hidden="true" />, "Ctrl+U")}
          {markButton("Strikethrough", "strike", <StrikethroughIcon aria-hidden="true" />, "Ctrl+Shift+X")}
          {markButton("Superscript", "superscript", <SuperscriptIcon aria-hidden="true" />, "Ctrl+.")}
          {markButton("Subscript", "subscript", <SubscriptIcon aria-hidden="true" />, "Ctrl+,")}
          <ColorMenu label="Text color" icon={<BaselineIcon aria-hidden="true" />} value={textColor} colors={colors} disabled={locked} onPick={(hex) => applyStyle("text_color", hex)} onClear={() => run(setStyleMark("text_color", null))} />
          <ColorMenu label="Highlight color" icon={<HighlighterIcon aria-hidden="true" />} value={highlight} colors={colors} disabled={locked} onPick={(hex) => applyStyle("background_color", hex)} onClear={() => run(setStyleMark("background_color", null))} />
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
              <Toolbar.Button aria-label="Link" title="Link (Ctrl+K)" aria-keyshortcuts="Control+K" aria-pressed={Boolean(link)} disabled={locked} className={tool}>
                <LinkIcon aria-hidden="true" />
              </Toolbar.Button>
            }
          />
          {separator}
          <Toolbar.Button aria-label="Bulleted list" aria-pressed={list?.kind === "bullet"} disabled={locked} onClick={() => run(toggleList("bullet"))} className={tool}>
            <ListIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Numbered list" aria-pressed={list?.kind === "ordered"} disabled={locked} onClick={() => run(toggleList("ordered"))} className={tool}>
            <ListOrderedIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Decrease indent" title="Decrease indent (Ctrl+[)" disabled={locked || !canOutdent(editorState)} onClick={() => run(changeIndent(-1))} className={tool}>
            <IndentDecreaseIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Increase indent" title="Increase indent (Ctrl+])" disabled={locked} onClick={() => run(changeIndent(1))} className={tool}>
            <IndentIncreaseIcon aria-hidden="true" />
          </Toolbar.Button>
          {separator}
          {(["left", "center", "right", "justify"] as const).map((item) => (
            <Toolbar.Button key={item} aria-label={`Align ${item}`} aria-pressed={align === item} disabled={locked} onClick={() => run(setAlign(item))} className={tool}>
              {ALIGN_ICONS[item]}
            </Toolbar.Button>
          ))}
          {!compact && (
            <>
              {separator}
              <Toolbar.Button aria-label="Insert table" disabled={locked} onClick={() => run(insertTable(3, 3))} className={tool}>
                <Table2Icon aria-hidden="true" />
              </Toolbar.Button>
              {inTable && !locked && <TableMenu state={editorState} run={run} />}
              <UrlDialog
                open={imageOpen}
                onOpenChange={setImageOpen}
                title={image ? "Edit image" : "Insert image"}
                submitLabel={image ? "Update" : "Insert"}
                fields={[
                  { name: "src", label: "Image URL", initial: image?.src ?? "", placeholder: "https://example.com/photo.jpg" },
                  { name: "alt", label: "Description (alt text)", initial: image?.alt ?? "" },
                  { name: "width", label: "Width in pixels (optional)", initial: image?.width ? String(image.width) : "", type: "number" },
                ]}
                validate={(values) => (safeImageSrc((values.src ?? "").trim()) ? null : "Use an https:// image address or a data:image URI.")}
                onSubmit={(values) => run(placeImage({ src: values.src ?? "", alt: values.alt ?? "", width: values.width ? Number(values.width) : null }))}
                {...(onImageUpload
                  ? {
                      extra: (
                        <>
                          <input
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => {
                              const files = imageFiles(event.target.files);
                              event.target.value = "";
                              if (!files.length) return;
                              setImageOpen(false);
                              void uploadImages(files, viewRef.current?.state.selection.from ?? 0, Boolean(image));
                            }}
                          />
                          <button type="button" onClick={() => fileInput.current?.click()} className={cn("flex h-8 items-center justify-center gap-2 rounded-md border border-dashed border-input hover:bg-accent [&_svg]:size-4", focusRing)}>
                            <UploadIcon aria-hidden="true" />
                            Upload from your computer
                          </button>
                        </>
                      ),
                    }
                  : {})}
                trigger={
                  <Toolbar.Button aria-label={image ? "Edit image" : "Insert image"} aria-pressed={Boolean(image)} disabled={locked} className={tool}>
                    <ImageIcon aria-hidden="true" />
                  </Toolbar.Button>
                }
              />
              <UrlDialog
                open={videoOpen}
                onOpenChange={setVideoOpen}
                title="Embed video"
                submitLabel="Embed"
                fields={[
                  { name: "url", label: "YouTube, Vimeo or Loom link, or a video file", placeholder: "https://www.youtube.com/watch?v=…" },
                  { name: "title", label: "Title (read by screen readers)" },
                ]}
                validate={(values) => (embedFromUrl(values.url ?? "") ? null : "Use a YouTube, Vimeo or Loom link, or an https:// link to an .mp4 or .webm file.")}
                onSubmit={(values) => run(insertEmbed(values.url ?? "", values.title ?? ""))}
                trigger={
                  <Toolbar.Button aria-label="Embed video" disabled={locked} className={tool}>
                    <VideoIcon aria-hidden="true" />
                  </Toolbar.Button>
                }
              />
              <Toolbar.Button aria-label="Insert divider" disabled={locked} onClick={() => run(insertHorizontalRule)} className={tool}>
                <MinusIcon aria-hidden="true" />
              </Toolbar.Button>
            </>
          )}
          {compact && separator}
          <Toolbar.Button aria-label="Clear formatting" disabled={locked} onClick={() => run(clearFormatting)} className={tool}>
            <RemoveFormattingIcon aria-hidden="true" />
          </Toolbar.Button>
          {!compact && (
            <>
              {separator}
              <Toolbar.Button aria-label="Find and replace" title="Find and replace (Ctrl+F)" aria-keyshortcuts="Control+F" aria-pressed={finder.open} disabled={locked} onClick={() => (finder.open ? finder.close() : finder.show())} className={tool}>
                <SearchIcon aria-hidden="true" />
              </Toolbar.Button>
              {sourceView && (
                <Toolbar.Button aria-label="HTML source" title="HTML source" aria-pressed={locked} onClick={toggleSource} className={tool}>
                  <CodeXmlIcon aria-hidden="true" />
                </Toolbar.Button>
              )}
              <ActionMenu
                trigger={
                  <Toolbar.Button aria-label="Export" className={tool}>
                    <DownloadIcon aria-hidden="true" />
                  </Toolbar.Button>
                }
                items={[
                  { id: "html", label: "Web page (.html)", onSelect: () => exportAs("html") },
                  { id: "doc", label: "Word (.doc)", onSelect: () => exportAs("doc") },
                  { type: "separator", id: "s" },
                  { id: "copy", label: "Copy HTML", onSelect: () => void navigator.clipboard?.writeText(docToHtml(getDoc())).catch(() => undefined) },
                  { id: "print", label: "Print or save as PDF", onSelect: () => printHtml(title, docToHtml(getDoc()), exportCss()) },
                ]}
              />
            </>
          )}
          {slot("Toolbar")}
          {toolbarActions && <div className="ml-auto flex items-center gap-1">{toolbarActions}</div>}
        </Toolbar.Root>
      )}
      <FindBar open={finder.open && !locked} onClose={finder.close} viewRef={viewRef} state={editorState} readOnly={readOnly} inputRef={finder.inputRef} />
      <div className={cn("flex min-h-0 min-w-0", locked && "hidden")} style={{ height }}>
        <div
          ref={surfaceRef}
          {...(surface === "page" ? { "data-theme": "light" } : {})}
          className={cn("relative min-w-0 flex-1 overflow-y-auto bg-background text-foreground", surface === "page" && "[color-scheme:light]", ...(compact ? [] : extensions.map((extension) => extension.surfaceClassName?.(effectiveProps))))}
        >
          <div ref={mountRef} />
          {slot("Overlay")}
        </div>
        {slot("Aside")}
      </div>
      {locked && (
        <div className="flex min-h-0 flex-col" style={{ height }}>
          <CodeEditor language="html" value={source} onValueChange={editSource} wrap autoFocus aria-label="HTML source" className="min-h-0 flex-1 rounded-none border-0" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-1 text-xs text-muted-foreground tabular-nums">
        <span>
          {counts.words} {counts.words === 1 ? "word" : "words"}
        </span>
        <span>
          {counts.characters} {counts.characters === 1 ? "character" : "characters"}
        </span>
        {locked && <span>Editing HTML. Tags and attributes the editor doesn't support are removed when you switch back.</span>}
        {slot("Status")}
        <span role="status" className="ml-auto">
          {status}
        </span>
      </div>
    </div>
  );
}
