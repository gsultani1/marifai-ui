// packages/ai-ui/src/components/page-builder.tsx
"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Columns2Icon,
  CopyIcon,
  DownloadIcon,
  HeadingIcon,
  ImageIcon,
  MinusIcon,
  MousePointerClickIcon,
  PanelTopIcon,
  Redo2Icon,
  Share2Icon,
  SlidersHorizontalIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  UnfoldVerticalIcon,
  VideoIcon,
} from "lucide-react";
import { type DragEvent, type KeyboardEvent, type ReactNode, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText, safeFileName } from "../lib/download.js";
import {
  BLOCK_PADDING,
  BUILDER_BLOCK_LABELS,
  type BuilderBlock,
  type BuilderBlockPatch,
  type BuilderBlockType,
  type BuilderDocument,
  type BuilderDocumentPatch,
  type BuilderMode,
  blocksIn,
  builderBlockLabel,
  builderToHtml,
  cachedLeafHtml,
  canContain,
  columnsOwning,
  createBuilderBlock,
  createBuilderDocument,
  duplicateBuilderBlock,
  findBuilderBlock,
  insertBuilderBlock,
  isLeafBlock,
  moveBuilderBlock,
  normalizeBuilderDocument,
  nudgeBuilderBlock,
  patchBuilderDocument,
  removeBuilderBlock,
  ROOT_CONTAINER,
  rootIndexOf,
  updateBuilderBlock,
} from "../lib/page-builder.js";
import { safeFontFamily } from "../lib/rich-text/html.js";
import { ActionMenu } from "./action-menu.js";
import { BlockSettings, DocumentSettings } from "./page-builder-panels.js";
import { SegmentedControl } from "./segmented-control.js";

export interface PageBuilderProps {
  /** The design; when it changes from outside, it replaces the current one and joins the undo history. */
  value?: BuilderDocument;
  defaultValue?: BuilderDocument;
  /** Called with the new design after every change. */
  onValueChange?: (doc: BuilderDocument) => void;
  /** Select a block from a synchronized layer tree or other inspector. */
  selectedBlockId?: string | null;
  onSelectedBlockChange?: (id: string | null) => void;
  /** "email" exports table-based HTML with inline styles for mail clients; "page" exports a responsive web page. */
  mode?: BuilderMode;
  /** Uploads an image file and resolves to its URL; enables "Upload image" on image blocks. */
  onImageUpload?: (file: File) => Promise<string>;
  /** Height of the canvas and settings panel. */
  height?: number | string;
  /** Accessible name of the builder, e.g. "Spring sale email". */
  label?: string;
  /** Workspace layout keeps the inspector closed until requested. */
  layout?: "default" | "workspace";
  toolbar?: ReactNode;
  className?: string;
}

const PALETTE: Array<{ type: BuilderBlockType; icon: ReactNode }> = [
  { type: "heading", icon: <HeadingIcon aria-hidden="true" /> },
  { type: "text", icon: <TypeIcon aria-hidden="true" /> },
  { type: "image", icon: <ImageIcon aria-hidden="true" /> },
  { type: "button", icon: <MousePointerClickIcon aria-hidden="true" /> },
  { type: "divider", icon: <MinusIcon aria-hidden="true" /> },
  { type: "spacer", icon: <UnfoldVerticalIcon aria-hidden="true" /> },
  { type: "columns", icon: <Columns2Icon aria-hidden="true" /> },
  { type: "section", icon: <PanelTopIcon aria-hidden="true" /> },
  { type: "social", icon: <Share2Icon aria-hidden="true" /> },
  { type: "video", icon: <VideoIcon aria-hidden="true" /> },
];

const MOBILE_WIDTH = 375;
const HISTORY_LIMIT = 100;

type DragPayload = { kind: "new"; type: BuilderBlockType } | { kind: "move"; id: string };

interface History {
  past: BuilderDocument[];
  present: BuilderDocument;
  future: BuilderDocument[];
  /** Consecutive changes with the same key merge into one undo step. */
  key: string | null;
}

const isEditable = (target: EventTarget) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Visual builder for emails and web pages: add blocks from the palette by
 * click or drag (headings, rich text edited in HtmlEditor, images,
 * buttons, dividers, spacers, social links, video, columns and sections),
 * drag or use the keyboard to reorder them, edit each block and the
 * document in the settings panel, check desktop and mobile widths, preview
 * the real output in a sandboxed frame, and export email-safe or web HTML
 * plus the design as JSON. The canvas and the export share one renderer,
 * and every value is escaped, checked or sanitized when rendered.
 */
export function PageBuilder({
  value, defaultValue, onValueChange, selectedBlockId, onSelectedBlockChange,
  mode = "email", onImageUpload, height = "36rem", label = mode === "email" ? "Email builder" : "Page builder",
  layout = "default", toolbar, className,
}: PageBuilderProps) {
  const workspace = layout === "workspace";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showSettings = !workspace || settingsOpen;
  const [history, setHistory] = useState<History>(() => ({ past: [], present: normalizeBuilderDocument(value ?? defaultValue ?? createBuilderDocument(mode), mode), future: [], key: null }));
  const [seenValue, setSeenValue] = useState(value);
  const [selectedId, setSelectedId] = useControllableState<string | null>({
    value: selectedBlockId, defaultValue: null, onChange: onSelectedBlockChange,
  });
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [drop, setDrop] = useState<{ containerId: string; index: number } | null>(null);
  const [status, setStatus] = useState("");
  const drag = useRef<DragPayload | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  if (value !== undefined && value !== seenValue) {
    setSeenValue(value);
    if (value !== history.present) setHistory((current) => ({ past: [...current.past, current.present].slice(-HISTORY_LIMIT), present: normalizeBuilderDocument(value, mode), future: [], key: null }));
  }

  const doc = history.present;
  const { settings } = doc;
  const selected = selectedId ? findBuilderBlock(doc, selectedId) : null;
  const pageWidth = device === "mobile" ? Math.min(MOBILE_WIDTH, settings.width) : settings.width;
  const target = mode === "email" ? "email" : "web";

  const commit = (next: BuilderDocument, key?: string) => {
    if (next === doc) return;
    setHistory((current) => ({ past: key !== undefined && key === current.key ? current.past : [...current.past, current.present].slice(-HISTORY_LIMIT), present: next, future: [], key: key ?? null }));
    onValueChange?.(next);
  };

  const travel = (direction: "undo" | "redo") => {
    const source = direction === "undo" ? history.past : history.future;
    const next = source.at(-1);
    if (!next) return;
    setHistory({
      past: direction === "undo" ? history.past.slice(0, -1) : [...history.past, history.present],
      present: next,
      future: direction === "undo" ? [...history.future, history.present] : history.future.slice(0, -1),
      key: null,
    });
    onValueChange?.(next);
    setStatus(direction === "undo" ? "Undone" : "Redone");
  };

  const focusBlock = (id: string | null) => {
    requestAnimationFrame(() => {
      const element = id ? canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`) : null;
      element?.focus();
    });
  };

  /* ---------------- block actions ---------------- */

  const addBlock = (type: BuilderBlockType) => {
    const block = createBuilderBlock(type);
    let containerId = ROOT_CONTAINER;
    let index = doc.blocks.length;
    if (selected) {
      const current = selected.block;
      if (current.type === "section" && canContain(doc, current.id, type)) {
        containerId = current.id;
        index = current.blocks.length;
      } else if (current.type === "columns" && isLeafBlock(block)) {
        const column = current.columns.find((item) => item.blocks.length === 0) ?? current.columns.at(-1)!;
        containerId = column.id;
        index = column.blocks.length;
      } else if (canContain(doc, selected.containerId, type)) {
        containerId = selected.containerId;
        index = selected.index + 1;
      } else {
        const top = rootIndexOf(doc, current.id);
        index = top >= 0 ? top + 1 : doc.blocks.length;
      }
    }
    commit(insertBuilderBlock(doc, block, containerId, index));
    setSelectedId(block.id);
    setStatus(`Added ${BUILDER_BLOCK_LABELS[type].toLowerCase()}`);
    focusBlock(block.id);
  };

  const removeBlock = (id: string) => {
    const location = findBuilderBlock(doc, id);
    if (!location) return;
    const next = removeBuilderBlock(doc, id);
    commit(next);
    const siblings = blocksIn(next, location.containerId);
    const neighbour = siblings[Math.min(location.index, siblings.length - 1)]?.id ?? null;
    setSelectedId(neighbour);
    setStatus(`Deleted ${BUILDER_BLOCK_LABELS[location.block.type].toLowerCase()}. Press Ctrl+Z to undo.`);
    focusBlock(neighbour);
  };

  const duplicate = (id: string) => {
    const result = duplicateBuilderBlock(doc, id);
    if (!result.id) return;
    commit(result.doc);
    setSelectedId(result.id);
    setStatus("Duplicated");
    focusBlock(result.id);
  };

  const nudge = (id: string, delta: -1 | 1) => {
    const next = nudgeBuilderBlock(doc, id, delta);
    if (next === doc) return;
    commit(next);
    setStatus(delta < 0 ? "Moved up" : "Moved down");
    focusBlock(id);
  };

  /** Moves a block inside a columns block to the end of the previous or next column. */
  const moveAcross = (id: string, delta: -1 | 1) => {
    const location = findBuilderBlock(doc, id);
    const parent = location ? columnsOwning(doc, location.containerId) : null;
    if (!location || !parent) return;
    const index = parent.columns.findIndex((column) => column.id === location.containerId) + delta;
    const column = parent.columns[index];
    if (!column) return;
    commit(moveBuilderBlock(doc, id, column.id, column.blocks.length));
    setStatus(`Moved to column ${index + 1}`);
    focusBlock(id);
  };

  const updateBlock = (id: string, patch: BuilderBlockPatch, field?: string) => commit(updateBuilderBlock(doc, id, patch), field ? `${id}:${field}` : undefined);
  const updateDocument = (patch: BuilderDocumentPatch, field?: string) => commit(patchBuilderDocument(doc, patch), field ? `document:${field}` : undefined);

  /* ---------------- drag and drop ---------------- */

  const dragType = (): BuilderBlockType | undefined => {
    const payload = drag.current;
    if (!payload) return undefined;
    return payload.kind === "new" ? payload.type : findBuilderBlock(doc, payload.id)?.block.type;
  };

  const endDrag = () => {
    drag.current = null;
    setDrop(null);
  };

  const onContainerDragOver = (event: DragEvent<HTMLElement>, containerId: string) => {
    const type = dragType();
    if (!type || !canContain(doc, containerId, type)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = drag.current?.kind === "new" ? "copy" : "move";
    const children = [...event.currentTarget.querySelectorAll<HTMLElement>(":scope > [data-block-id]")];
    const index = children.findIndex((child) => {
      const rect = child.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    const at = index < 0 ? children.length : index;
    if (drop?.containerId !== containerId || drop.index !== at) setDrop({ containerId, index: at });
  };

  const onContainerDrop = (event: DragEvent<HTMLElement>, containerId: string) => {
    const payload = drag.current;
    if (!payload || !drop || drop.containerId !== containerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (payload.kind === "new") {
      const block = createBuilderBlock(payload.type);
      commit(insertBuilderBlock(doc, block, containerId, drop.index));
      setSelectedId(block.id);
      setStatus(`Added ${BUILDER_BLOCK_LABELS[payload.type].toLowerCase()}`);
    } else {
      commit(moveBuilderBlock(doc, payload.id, containerId, drop.index));
      setSelectedId(payload.id);
      setStatus("Moved");
    }
    endDrag();
  };

  /* ---------------- keyboard ---------------- */

  const onBlockKeyDown = (event: KeyboardEvent<HTMLElement>, block: BuilderBlock) => {
    if (event.target !== event.currentTarget) return;
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeBlock(block.id);
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      nudge(block.id, event.key === "ArrowUp" ? -1 : 1);
    } else if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      moveAcross(block.id, event.key === "ArrowLeft" ? -1 : 1);
    } else if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicate(block.id);
    } else if (!event.altKey && !mod && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const frames = [...(canvasRef.current?.querySelectorAll<HTMLElement>("[data-block-id]") ?? [])];
      frames[frames.indexOf(event.currentTarget) + (event.key === "ArrowUp" ? -1 : 1)]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      const parent = event.currentTarget.parentElement?.closest<HTMLElement>("[data-block-id]");
      if (parent) parent.focus();
      else {
        setSelectedId(null);
        event.currentTarget.blur();
      }
    }
  };

  const onRootKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditable(event.target)) return;
    const key = event.key.toLowerCase();
    if (key === "z" || key === "y") {
      event.preventDefault();
      travel(key === "y" || event.shiftKey ? "redo" : "undo");
    }
  };

  /* ---------------- export ---------------- */

  const fileName = safeFileName(doc.title, mode);
  const copyHtml = () =>
    void navigator.clipboard
      ?.writeText(builderToHtml(doc, { target }))
      .then(() => setStatus("Copied HTML"))
      .catch(() => setStatus("Couldn't copy to the clipboard"));
  const openDesign = async (file: File) => {
    try {
      const next = normalizeBuilderDocument(JSON.parse(await file.text()) as unknown, mode);
      commit(next);
      setSelectedId(null);
      setStatus(`Opened ${file.name}`);
    } catch {
      setStatus(`${file.name} isn't a design file`);
    }
  };

  /* ---------------- canvas rendering ---------------- */

  const dropLine = (containerId: string, index: number) => (drop?.containerId === containerId && drop.index === index ? <div key={`drop-${index}`} aria-hidden="true" className="pointer-events-none h-0.5 rounded-full bg-primary" /> : null);

  const renderContainer = (containerId: string, blocks: BuilderBlock[], available: number, inset: number, empty: string): ReactNode => (
    <div data-container-id={containerId} onDragOver={(event) => onContainerDragOver(event, containerId)} onDrop={(event) => onContainerDrop(event, containerId)} className="flex min-h-10 flex-col">
      {blocks.flatMap((block, index) => [dropLine(containerId, index), renderBlock(block, available, inset)])}
      {dropLine(containerId, blocks.length)}
      {blocks.length === 0 && <div className="m-1 flex min-h-14 items-center justify-center rounded-md border-2 border-dashed border-border px-3 text-center text-sm text-muted-foreground">{empty}</div>}
    </div>
  );

  const renderBlock = (block: BuilderBlock, available: number, inset: number): ReactNode => {
    const isSelected = block.id === selectedId;
    let content: ReactNode;
    if (block.type === "section") {
      content = (
        <div style={{ background: block.background, padding: block.padding }}>{renderContainer(block.id, block.blocks, available - block.padding * 2, 0, "Drag blocks into this section, or select it and add from the palette")}</div>
      );
    } else if (block.type === "columns") {
      const width = Math.floor((available - inset * 2 - block.gap * (block.columns.length - 1)) / block.columns.length);
      content = (
        <div className="flex @max-[30rem]:flex-col" style={{ gap: block.gap, padding: `0 ${inset}px` }}>
          {block.columns.map((column, index) => (
            <div key={column.id} className="min-w-0 flex-1">
              {renderContainer(column.id, column.blocks, width, 0, `Column ${index + 1}`)}
            </div>
          ))}
        </div>
      );
    } else {
      content = <div inert style={{ padding: `${BLOCK_PADDING}px ${inset}px` }} dangerouslySetInnerHTML={{ __html: cachedLeafHtml(block, { target: "web", settings, available: available - inset * 2, editing: true }) }} />;
    }
    return (
      <div
        key={block.id}
        data-block-id={block.id}
        role="group"
        aria-label={builderBlockLabel(block)}
        aria-current={isSelected || undefined}
        tabIndex={0}
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          drag.current = { kind: "move", id: block.id };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", builderBlockLabel(block));
        }}
        onDragEnd={endDrag}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setSelectedId(block.id);
        }}
        onClick={(event) => {
          event.stopPropagation();
          setSelectedId(block.id);
        }}
        onKeyDown={(event) => onBlockKeyDown(event, block)}
        className={cn("relative cursor-default outline-none", isSelected ? "z-10 outline-2 -outline-offset-2 outline-primary" : "hover:outline-1 hover:-outline-offset-1 hover:outline-primary/60", "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring")}
      >
        {isSelected && (
          <div className="absolute top-1 right-1 z-20 flex rounded-md border border-border bg-background shadow-sm">
            <button type="button" aria-label="Move up" title="Move up (Alt+Up)" onClick={() => nudge(block.id, -1)} className={cn(iconButton, "size-7", focusRing)}>
              <ArrowUpIcon aria-hidden="true" />
            </button>
            <button type="button" aria-label="Move down" title="Move down (Alt+Down)" onClick={() => nudge(block.id, 1)} className={cn(iconButton, "size-7", focusRing)}>
              <ArrowDownIcon aria-hidden="true" />
            </button>
            <button type="button" aria-label="Duplicate" title="Duplicate (Ctrl+D)" onClick={() => duplicate(block.id)} className={cn(iconButton, "size-7", focusRing)}>
              <CopyIcon aria-hidden="true" />
            </button>
            <button type="button" aria-label="Delete" title="Delete (Delete)" onClick={() => removeBlock(block.id)} className={cn(iconButton, "size-7 hover:text-destructive", focusRing)}>
              <Trash2Icon aria-hidden="true" />
            </button>
          </div>
        )}
        {content}
      </div>
    );
  };

  const font = safeFontFamily(settings.fontFamily) ?? "Arial, sans-serif";

  return (
    <section aria-label={label} data-slot="page-builder" onKeyDown={onRootKeyDown} className={cn("@container flex flex-col overflow-hidden bg-background text-foreground", !workspace && "rounded-lg border border-border", className)}>
      <div role="group" aria-label={`${label} actions`} className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
        <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={history.past.length === 0} onClick={() => travel("undo")} className={cn(iconButton, focusRing)}>
          <Undo2Icon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={history.future.length === 0} onClick={() => travel("redo")} className={cn(iconButton, focusRing)}>
          <Redo2Icon aria-hidden="true" />
        </button>
        <SegmentedControl
          label="Width"
          size="sm"
          value={device}
          onValueChange={setDevice}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "mobile", label: "Mobile" },
          ]}
        />
        {!workspace && <SegmentedControl
          label="View"
          size="sm"
          value={view}
          onValueChange={setView}
          options={[
            { value: "edit", label: "Edit" },
            { value: "preview", label: "Preview" },
          ]}
        />}
        <span role="status" className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
          {status}
        </span>
        {toolbar}
        {workspace && <button type="button" aria-pressed={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}
          className={cn(button, buttonVariants.ghost, "aria-pressed:bg-accent", focusRing)}>
          <SlidersHorizontalIcon aria-hidden="true" />
          Properties
        </button>}
        <input
          ref={importInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void openDesign(file);
          }}
        />
        <ActionMenu
          align="end"
          trigger={
            <button type="button" className={cn(button, buttonVariants.outline, focusRing)}>
              <DownloadIcon aria-hidden="true" />
              Export
            </button>
          }
          items={[
            { id: "copy", label: mode === "email" ? "Copy email HTML" : "Copy page HTML", onSelect: copyHtml },
            { id: "html", label: "Download HTML", onSelect: () => downloadText(`${fileName}.html`, builderToHtml(doc, { target }), "text/html;charset=utf-8") },
            { type: "separator", id: "s" },
            { id: "json", label: "Download design (.json)", onSelect: () => downloadText(`${fileName}.json`, `${JSON.stringify(doc, null, 2)}\n`, "application/json") },
            { id: "open", label: "Open design (.json)…", onSelect: () => importInput.current?.click() },
          ]}
        />
      </div>
      {view === "edit" && (
        <div role="group" aria-label="Add block" className={cn("flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5", workspace && "bg-muted/25")}>
          <span aria-hidden="true" className="mr-1 text-xs font-medium text-muted-foreground">
            Add
          </span>
          {PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              draggable
              onDragStart={(event) => {
                drag.current = { kind: "new", type: item.type };
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData("text/plain", BUILDER_BLOCK_LABELS[item.type]);
              }}
              onDragEnd={endDrag}
              onClick={() => addBlock(item.type)}
              className={cn(button, buttonVariants.ghost, "h-8 px-2 text-foreground", workspace && "cursor-grab active:cursor-grabbing", focusRing)}
            >
              {item.icon}
              <span className="sr-only">Add </span>
              {BUILDER_BLOCK_LABELS[item.type]}
            </button>
          ))}
        </div>
      )}
      <div className={cn("grid min-h-0 flex-1 grid-cols-1", showSettings && "@3xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        {view === "edit" ? (
          <div
            ref={canvasRef}
            role="region"
            aria-label={`${label} canvas`}
            onClick={() => setSelectedId(null)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
            }}
            className={cn("min-w-0 overflow-auto p-4 @md:p-6", workspace && "p-3 @3xl:px-10 [background-image:radial-gradient(#64748b40_1px,transparent_1px)] [background-size:16px_16px]")}
            style={{ height, background: settings.background }}
          >
            <div data-theme="light" className={cn("@container mx-auto max-w-full [color-scheme:light]", workspace && "overflow-hidden rounded-sm shadow-[0_2px_12px_#0f172a26]")} style={{ width: pageWidth, background: settings.contentBackground, color: settings.textColor, fontFamily: font, padding: `${BLOCK_PADDING}px 0` }}>
              {renderContainer(ROOT_CONTAINER, doc.blocks, pageWidth, settings.padding, "Add blocks from the palette, or drag them here")}
            </div>
          </div>
        ) : (
          <div className="min-w-0 overflow-auto p-4" style={{ height, background: settings.background }}>
            <iframe title={`${label} preview`} sandbox="" srcDoc={builderToHtml(doc, { target })} className="mx-auto block h-full max-w-full border-0 bg-white" style={{ width: pageWidth + (target === "email" ? 24 : 0) }} />
          </div>
        )}
        {showSettings && <aside aria-label={selected ? "Block settings" : "Design settings"} className="flex min-w-0 flex-col gap-3 overflow-y-auto border-t border-border p-3 @3xl:border-t-0 @3xl:border-l" style={{ maxHeight: height }}>
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{selected ? BUILDER_BLOCK_LABELS[selected.block.type] : mode === "email" ? "Email settings" : "Page settings"}</h3>
            {selected && (
              <button type="button" onClick={() => setSelectedId(null)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                {mode === "email" ? "Email settings" : "Page settings"}
              </button>
            )}
          </div>
          {selected ? (
            <BlockSettings key={selected.block.id} block={selected.block} settings={settings} mode={mode} onChange={(patch, field) => updateBlock(selected.block.id, patch, field)} onImageUpload={onImageUpload} onStatus={setStatus} />
          ) : (
            <DocumentSettings doc={doc} mode={mode} onChange={updateDocument} />
          )}
        </aside>}
      </div>
    </section>
  );
}
