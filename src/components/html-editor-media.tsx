// packages/ai-ui/src/components/html-editor-media.tsx
"use client";

import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  Columns2Icon,
  Columns3Icon,
  ImageUpIcon,
  InfoIcon,
  LightbulbIcon,
  MoveHorizontalIcon,
  OctagonAlertIcon,
  PaintBucketIcon,
  RectangleHorizontalIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { deleteSelection } from "prosemirror-commands";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { isInTable } from "prosemirror-tables";
import type { EditorView } from "prosemirror-view";
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { emitEditorEvent, RICH_TEXT_EVENTS } from "../lib/rich-text/events.js";
import type { CalloutTone, FigureAlign } from "../lib/rich-text/html.js";
import {
  CALLOUT_TONE_LABELS,
  calloutView,
  CELL_COLORS,
  columnsView,
  currentCellBackground,
  currentColumnWidth,
  evenTableColumns,
  FIGURE_BOX_SELECTOR,
  FIGURE_SIZE_PRESETS,
  figureSizePreset,
  figureView,
  imageEmbedPlugin,
  insertColumns,
  type MediaViewContext,
  mediaUiPlugin,
  resizeTableColumn,
  selectedCellCount,
  selectedFigure,
  setCalloutTone,
  setCellBackground,
  tableResizingPlugin,
  unwrapCallout,
  updateFigure,
  wrapInCallout,
} from "../lib/rich-text/html-media.js";
import { usePortalContainer } from "../lib/portal.js";
import { ActionMenu } from "./action-menu.js";
import type { HtmlEditorExtension, HtmlEditorExtensionSetup, HtmlEditorRenderProps, HtmlSlashItem } from "./html-editor-extension.js";
import { editorTool, ToolbarSeparator } from "./rich-text-parts.js";

/** Connects the node views and keymap, created once per editor, to the React overlay that renders menus and the figure toolbar. */
class MediaBridge {
  private focusToolbar: (() => boolean) | null = null;
  private openMenu: ((pos: number, anchor: HTMLElement) => void) | null = null;

  connectFigureToolbar(focus: () => boolean): () => void {
    this.focusToolbar = focus;
    return () => {
      if (this.focusToolbar === focus) this.focusToolbar = null;
    };
  }

  connectToneMenu(open: (pos: number, anchor: HTMLElement) => void): () => void {
    this.openMenu = open;
    return () => {
      if (this.openMenu === open) this.openMenu = null;
    };
  }

  focusFigureToolbar(): boolean {
    return this.focusToolbar?.() ?? false;
  }

  openToneMenu(pos: number, anchor: HTMLElement): void {
    this.openMenu?.(pos, anchor);
  }
}

const menuItem =
  "flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";

const menuPopup = cn(popupSurface, "max-h-[var(--available-height)] min-w-44 overflow-y-auto p-1 outline-none");

const TONE_ICONS: Record<CalloutTone, ReactNode> = {
  info: <InfoIcon aria-hidden="true" className="text-chart-1" />,
  note: <LightbulbIcon aria-hidden="true" className="text-muted-foreground" />,
  success: <CircleCheckIcon aria-hidden="true" className="text-success" />,
  warning: <TriangleAlertIcon aria-hidden="true" className="text-warning" />,
  danger: <OctagonAlertIcon aria-hidden="true" className="text-destructive" />,
};

const TONE_ORDER: readonly CalloutTone[] = ["info", "note", "success", "warning", "danger"];

const ALIGN_OPTIONS: ReadonlyArray<{ value: FigureAlign; label: string; icon: ReactNode }> = [
  { value: "left", label: "Align image left", icon: <AlignLeftIcon aria-hidden="true" /> },
  { value: "center", label: "Center image", icon: <AlignCenterIcon aria-hidden="true" /> },
  { value: "right", label: "Align image right", icon: <AlignRightIcon aria-hidden="true" /> },
  { value: "wide", label: "Full width image", icon: <RectangleHorizontalIcon aria-hidden="true" /> },
];

function figureBox(view: EditorView, pos: number): HTMLElement | null {
  const dom = view.nodeDOM(pos);
  return dom instanceof HTMLElement ? dom.querySelector<HTMLElement>(FIGURE_BOX_SELECTOR) : null;
}

/** Places the figure toolbar centered above the image, inside the image when there is no room above, and within the surface. */
function placeFigureToolbar(view: EditorView | null, surface: HTMLElement | null, toolbar: HTMLElement | null, pos: number): void {
  if (!view || !surface || !toolbar) return;
  const box = figureBox(view, pos);
  if (!box) return;
  const surfaceRect = surface.getBoundingClientRect();
  const rect = box.getBoundingClientRect();
  const width = toolbar.offsetWidth;
  const height = toolbar.offsetHeight;
  const left = rect.left - surfaceRect.left + surface.scrollLeft + rect.width / 2 - width / 2;
  const maxLeft = surface.scrollLeft + surface.clientWidth - width - 8;
  const above = rect.top - surfaceRect.top + surface.scrollTop - height - 8;
  const top = above < surface.scrollTop + 4 ? rect.top - surfaceRect.top + surface.scrollTop + 8 : above;
  toolbar.style.left = `${Math.max(surface.scrollLeft + 8, Math.min(left, maxLeft))}px`;
  toolbar.style.top = `${Math.max(0, top)}px`;
}

function AltTextButton({ alt, onSave }: { alt: string; onSave: (alt: string) => void }) {
  const container = usePortalContainer();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(alt);
  const [decorative, setDecorative] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setText(alt);
          setDecorative(false);
          setError(null);
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger
        render={
          <Toolbar.Button title="Alt text" className={cn(editorTool, "w-auto px-2 text-xs font-medium")}>
            Alt text
          </Toolbar.Button>
        }
      />
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={6} className="z-50">
          <Popover.Popup className={cn(popupSurface, "w-72 p-3 text-sm outline-none")}>
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = text.trim();
                if (!decorative && !value) {
                  setError("Describe the image, or mark it as decorative.");
                  return;
                }
                onSave(decorative ? "" : value);
                setOpen(false);
              }}
            >
              <Popover.Title className="font-medium">Alt text</Popover.Title>
              <Popover.Description className="text-xs text-muted-foreground">Describe what the image shows for people who can&apos;t see it.</Popover.Description>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Description</span>
                <textarea
                  autoFocus
                  rows={3}
                  value={decorative ? "" : text}
                  disabled={decorative}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setText(event.target.value);
                    setError(null);
                  }}
                  className={cn("min-h-16 resize-y rounded-md border border-input bg-background px-2 py-1 disabled:opacity-50", focusRing)}
                />
              </label>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={decorative}
                  onChange={(event) => {
                    setDecorative(event.target.checked);
                    setError(null);
                  }}
                  className={cn("mt-0.5 size-3.5 accent-primary", focusRing)}
                />
                <span>Decorative image. Screen readers skip it.</span>
              </label>
              {error && (
                <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Popover.Close className={cn("h-8 rounded-md px-3 hover:bg-accent", focusRing)}>Cancel</Popover.Close>
                <button type="submit" className={cn("h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground", focusRing)}>
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

interface FigureToolbarProps {
  pos: number;
  node: ProseMirrorNode;
  viewRef: RefObject<EditorView | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  setStatus: (message: string) => void;
  bridge: MediaBridge;
}

/** Floating toolbar for the selected figure: alignment, size, alt text, replace and delete. */
function FigureToolbar({ pos, node, viewRef, surfaceRef, setStatus, bridge }: FigureToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const align = node.attrs.align as FigureAlign;
  const width = node.attrs.width as number | null;
  const preset = figureSizePreset(width);
  const sizeLabel = align === "wide" ? "Full width" : (preset?.label ?? `${width ?? 0} px`);

  useLayoutEffect(() => placeFigureToolbar(viewRef.current, surfaceRef.current, ref.current, pos));

  useEffect(() => {
    const view = viewRef.current;
    const surface = surfaceRef.current;
    if (!view || !surface) return;
    const update = () => placeFigureToolbar(viewRef.current, surfaceRef.current, ref.current, pos);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const box = figureBox(view, pos);
    if (box) observer?.observe(box);
    observer?.observe(surface);
    surface.addEventListener("scroll", update, { passive: true });
    return () => {
      observer?.disconnect();
      surface.removeEventListener("scroll", update);
    };
  }, [pos, viewRef, surfaceRef]);

  useEffect(
    () =>
      bridge.connectFigureToolbar(() => {
        const toolbar = ref.current;
        const target = toolbar?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? toolbar?.querySelector<HTMLElement>("button");
        target?.focus();
        return Boolean(target);
      }),
    [bridge],
  );

  const apply = (command: Command): boolean => {
    const view = viewRef.current;
    return view ? command(view.state, view.dispatch, view) : false;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (event.key === "Escape" || (event.key === "Tab" && event.shiftKey)) {
      event.preventDefault();
      viewRef.current?.focus();
    }
  };

  return (
    <Toolbar.Root
      ref={ref}
      aria-label="Image"
      onKeyDown={onKeyDown}
      className="absolute top-0 left-0 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {ALIGN_OPTIONS.map((option) => (
        <Toolbar.Button key={option.value} aria-label={option.label} title={option.label} aria-pressed={align === option.value} onClick={() => apply(updateFigure(pos, { align: option.value }))} className={editorTool}>
          {option.icon}
        </Toolbar.Button>
      ))}
      <ToolbarSeparator />
      <ActionMenu
        trigger={
          <Toolbar.Button title="Image size" className={cn(editorTool, "w-auto gap-1 px-2 text-xs font-medium")}>
            <span className="sr-only">Image size: </span>
            {sizeLabel}
            <ChevronDownIcon aria-hidden="true" />
          </Toolbar.Button>
        }
        items={FIGURE_SIZE_PRESETS.map((option) => ({
          id: option.id,
          label: option.width ? `${option.label} (${option.width} px)` : option.label,
          checked: align !== "wide" && preset?.id === option.id,
          onSelect: () => {
            if (apply(updateFigure(pos, { width: option.width, ...(align === "wide" ? { align: "center" as const } : {}) }))) setStatus(`Image size ${option.label}${option.width ? `, ${option.width} pixels` : ""}`);
          },
        }))}
      />
      <AltTextButton
        alt={node.attrs.alt as string}
        onSave={(alt) => {
          apply(updateFigure(pos, { alt }));
          setStatus(alt ? "Alt text saved" : "Image marked as decorative");
        }}
      />
      <ToolbarSeparator />
      <Toolbar.Button
        aria-label="Replace image"
        title="Replace image"
        onClick={() => {
          const view = viewRef.current;
          if (view) emitEditorEvent(view, RICH_TEXT_EVENTS.openImage);
        }}
        className={editorTool}
      >
        <ImageUpIcon aria-hidden="true" />
      </Toolbar.Button>
      <Toolbar.Button
        aria-label="Delete image"
        title="Delete image"
        onClick={() => {
          if (!apply(deleteSelection)) return;
          setStatus("Image deleted");
          viewRef.current?.focus();
        }}
        className={cn(editorTool, "hover:text-destructive")}
      >
        <Trash2Icon aria-hidden="true" />
      </Toolbar.Button>
    </Toolbar.Root>
  );
}

interface ToneTarget {
  pos: number;
  anchor: HTMLElement;
}

/** Menu of callout tones, opened from a callout's icon button. */
function ToneMenu({ target, tone, viewRef, setStatus, onClose }: { target: ToneTarget; tone: CalloutTone; viewRef: RefObject<EditorView | null>; setStatus: (message: string) => void; onClose: () => void }) {
  const container = usePortalContainer();

  useEffect(() => {
    target.anchor.setAttribute("aria-expanded", "true");
    return () => target.anchor.setAttribute("aria-expanded", "false");
  }, [target]);

  const apply = (command: Command): boolean => {
    const view = viewRef.current;
    return view ? command(view.state, view.dispatch, view) : false;
  };

  return (
    <Menu.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Menu.Portal container={container}>
        <Menu.Positioner anchor={target.anchor} sideOffset={4} align="start" className="z-50">
          <Menu.Popup
            aria-label="Callout type"
            finalFocus={() => {
              viewRef.current?.focus();
              return false;
            }}
            className={menuPopup}
          >
            <Menu.RadioGroup
              value={tone}
              onValueChange={(value: CalloutTone) => {
                if (apply(setCalloutTone(target.pos, value))) setStatus(`Callout type: ${CALLOUT_TONE_LABELS[value]}`);
              }}
            >
              {TONE_ORDER.map((option) => (
                <Menu.RadioItem key={option} value={option} closeOnClick className={menuItem}>
                  {TONE_ICONS[option]}
                  <span className="flex-1">{CALLOUT_TONE_LABELS[option]}</span>
                  <Menu.RadioItemIndicator keepMounted className="data-[unchecked]:invisible">
                    <CheckIcon aria-hidden="true" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              onClick={() => {
                if (apply(unwrapCallout(target.pos))) setStatus("Callout removed");
              }}
              className={menuItem}
            >
              Remove callout
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MediaOverlay({ state, viewRef, surfaceRef, readOnly, locked, setStatus, bridge }: HtmlEditorRenderProps & { bridge: MediaBridge }) {
  const [toneTarget, setToneTarget] = useState<ToneTarget | null>(null);

  useEffect(() => bridge.connectToneMenu((pos, anchor) => setToneTarget({ pos, anchor })), [bridge]);

  const editing = !readOnly && !locked;
  const figure = editing ? selectedFigure(state) : null;
  const callout = toneTarget ? state.doc.nodeAt(toneTarget.pos) : null;
  return (
    <>
      {figure && <FigureToolbar key={figure.pos} pos={figure.pos} node={figure.node} viewRef={viewRef} surfaceRef={surfaceRef} setStatus={setStatus} bridge={bridge} />}
      {editing && toneTarget && callout?.type.name === "callout" && (
        <ToneMenu target={toneTarget} tone={callout.attrs.tone as CalloutTone} viewRef={viewRef} setStatus={setStatus} onClose={() => setToneTarget(null)} />
      )}
    </>
  );
}

function cellMeasure(view: EditorView): (cellPos: number) => number {
  return (cellPos) => {
    const dom = view.nodeDOM(cellPos);
    return dom instanceof HTMLElement ? dom.offsetWidth : 0;
  };
}

function cellColorName(value: string): string {
  return CELL_COLORS.find((color) => color.value === value)?.name ?? value;
}

/** Background swatches for the selected table cells. */
function CellColorMenu({ state, viewRef, setStatus }: Pick<HtmlEditorRenderProps, "state" | "viewRef" | "setStatus">) {
  const container = usePortalContainer();
  const current = currentCellBackground(state);
  const label = current.value ? `Cell color: ${cellColorName(current.value)}` : current.mixed ? "Cell color: mixed" : "Cell color";
  const apply = (value: string | null) => {
    const view = viewRef.current;
    if (!view) return;
    const count = selectedCellCount(view.state);
    if (!setCellBackground(value)(view.state, view.dispatch)) return;
    const cells = count === 1 ? "the cell" : `${count} cells`;
    setStatus(value ? `${cellColorName(value)} applied to ${cells}` : `Color removed from ${cells}`);
  };
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Toolbar.Button aria-label={label} title="Cell color" className={cn(editorTool, "relative")}>
            <PaintBucketIcon aria-hidden="true" />
            <span aria-hidden="true" className="absolute inset-x-2 bottom-1 h-0.5 rounded-full border border-border" style={{ background: current.value ?? "transparent" }} />
          </Toolbar.Button>
        }
      />
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="start" className="z-50">
          <Menu.Popup aria-label="Cell color" className={menuPopup}>
            <Menu.RadioGroup value={current.mixed ? "" : (current.value ?? "none")} onValueChange={(value: string) => apply(value === "none" ? null : value)}>
              <Menu.RadioItem value="none" closeOnClick className={menuItem}>
                <span aria-hidden="true" className="relative size-4 shrink-0 overflow-hidden rounded border border-border bg-background after:absolute after:top-1/2 after:left-1/2 after:h-px after:w-5 after:-translate-1/2 after:-rotate-45 after:bg-muted-foreground after:content-['']" />
                <span className="flex-1">No color</span>
                <Menu.RadioItemIndicator keepMounted className="data-[unchecked]:invisible">
                  <CheckIcon aria-hidden="true" />
                </Menu.RadioItemIndicator>
              </Menu.RadioItem>
              {CELL_COLORS.map((color) => (
                <Menu.RadioItem key={color.value} value={color.value} closeOnClick className={menuItem}>
                  <span aria-hidden="true" className="size-4 shrink-0 rounded border border-border" style={{ background: color.value }} />
                  <span className="flex-1">{color.name}</span>
                  <Menu.RadioItemIndicator keepMounted className="data-[unchecked]:invisible">
                    <CheckIcon aria-hidden="true" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const COLUMN_STEP = 20;

/** Keyboard alternative to dragging table column borders. */
function ColumnWidthMenu({ viewRef, setStatus }: Pick<HtmlEditorRenderProps, "viewRef" | "setStatus">) {
  const container = usePortalContainer();
  const resize = (delta: number) => {
    const view = viewRef.current;
    if (!view) return;
    const measure = cellMeasure(view);
    const changed = resizeTableColumn(delta, measure)(view.state, view.dispatch);
    const width = currentColumnWidth(view.state, measure);
    if (width !== null) setStatus(changed ? `Column width ${width} pixels` : `Column width ${width} pixels, the narrowest it can be`);
  };
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Toolbar.Button aria-label="Column width" title="Column width" className={editorTool}>
            <MoveHorizontalIcon aria-hidden="true" />
          </Toolbar.Button>
        }
      />
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="start" className="z-50">
          <Menu.Popup aria-label="Column width" className={menuPopup}>
            <Menu.Item closeOnClick={false} onClick={() => resize(COLUMN_STEP)} className={menuItem}>
              Widen column
            </Menu.Item>
            <Menu.Item closeOnClick={false} onClick={() => resize(-COLUMN_STEP)} className={menuItem}>
              Narrow column
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              onClick={() => {
                const view = viewRef.current;
                if (view && evenTableColumns(view.state, view.dispatch)) setStatus("Columns share the table width evenly");
              }}
              className={menuItem}
            >
              Even out column widths
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Table controls in the main toolbar, shown while the selection is in a table. */
function TableTools({ state, viewRef, readOnly, locked, setStatus }: HtmlEditorRenderProps) {
  if (readOnly || locked || !isInTable(state)) return null;
  return (
    <>
      <ToolbarSeparator />
      <CellColorMenu state={state} viewRef={viewRef} setStatus={setStatus} />
      <ColumnWidthMenu viewRef={viewRef} setStatus={setStatus} />
    </>
  );
}

/** Classes for the scrolling surface: contained floats, table column resizing and cell selection over colored cells. */
const SURFACE_CLASS = cn(
  "[&_.ProseMirror]:flow-root",
  "[&_.tableWrapper]:my-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper>table]:my-0",
  "[&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:-right-0.5 [&_.column-resize-handle]:-bottom-px [&_.column-resize-handle]:z-10 [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-primary",
  "[&_.resize-cursor]:cursor-col-resize",
  "[&_.selectedCell]:after:pointer-events-none [&_.selectedCell]:after:absolute [&_.selectedCell]:after:inset-0 [&_.selectedCell]:after:bg-primary/15 [&_.selectedCell]:after:content-['']",
);

function runCommand(command: Command): (view: EditorView) => void {
  return (view) => {
    command(view.state, view.dispatch, view);
    view.focus();
  };
}

/** Media and layout: figure resizing, alignment and captions, image paste and drop, callouts, columns, table column resizing and cell colors. */
export function createMediaExtension(setup: HtmlEditorExtensionSetup): HtmlEditorExtension {
  const bridge = new MediaBridge();
  const views = new Set<{ refresh: () => void }>();
  const isEditing = () => {
    const props = setup.getProps();
    return !props.compact && !props.readOnly;
  };
  const ctx: MediaViewContext = {
    editing: (view) => isEditing() && view.editable,
    setStatus: setup.setStatus,
    openToneMenu: (pos, anchor) => bridge.openToneMenu(pos, anchor),
    views,
  };
  const slashItems: HtmlSlashItem[] = [
    { id: "callout", label: "Callout", description: "Highlighted box for tips and key facts", keywords: ["info", "aside", "box", "tip", "highlight"], icon: <InfoIcon aria-hidden="true" />, group: "Basic blocks", turnInto: true, run: runCommand(wrapInCallout("info")) },
    { id: "callout-warning", label: "Warning callout", description: "Box that warns about a risk", keywords: ["caution", "alert", "danger", "callout"], icon: <TriangleAlertIcon aria-hidden="true" />, group: "Basic blocks", turnInto: true, run: runCommand(wrapInCallout("warning")) },
    { id: "callout-note", label: "Note", description: "Gray box for side notes", keywords: ["aside", "remark", "memo", "callout"], icon: <LightbulbIcon aria-hidden="true" />, group: "Basic blocks", turnInto: true, run: runCommand(wrapInCallout("note")) },
    { id: "columns-2", label: "2 columns", description: "Put blocks side by side", keywords: ["layout", "grid", "split", "side by side", "two"], icon: <Columns2Icon aria-hidden="true" />, group: "Layout", run: runCommand(insertColumns(2)) },
    { id: "columns-3", label: "3 columns", description: "Three blocks side by side", keywords: ["layout", "grid", "split", "side by side", "three"], icon: <Columns3Icon aria-hidden="true" />, group: "Layout", run: runCommand(insertColumns(3)) },
  ];
  return {
    name: "media",
    plugins: [
      mediaUiPlugin({ isEditing, setStatus: setup.setStatus, focusFigureToolbar: () => bridge.focusFigureToolbar(), views }),
      imageEmbedPlugin({ canEmbed: (view) => isEditing() && view.editable && !setup.getProps().onImageUpload, setStatus: setup.setStatus }),
      tableResizingPlugin(() => !setup.getProps().compact),
    ],
    nodeViews: {
      figure: (node, view, getPos) => figureView(node, view, getPos, ctx),
      callout: (node, view, getPos) => calloutView(node, view, getPos, ctx),
      columns: (node, view, getPos) => columnsView(node, view, getPos, ctx),
    },
    slashItems,
    surfaceClassName: () => SURFACE_CLASS,
    Toolbar: TableTools,
    Overlay: (props) => <MediaOverlay {...props} bridge={bridge} />,
  };
}
