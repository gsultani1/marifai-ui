// packages/ai-ui/src/components/html-editor-blocks.tsx
"use client";

import { Menu } from "@base-ui/react/menu";
import { Toolbar } from "@base-ui/react/toolbar";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoldIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  CopyIcon,
  GripVerticalIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PlusIcon,
  Repeat2Icon,
  SquareCodeIcon,
  StrikethroughIcon,
  Table2Icon,
  TextQuoteIcon,
  Trash2Icon,
  TypeIcon,
  UnderlineIcon,
  VideoIcon,
} from "lucide-react";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { type Command, Selection, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { isMarkActive } from "../lib/rich-text/commands.js";
import { emitEditorEvent, RICH_TEXT_EVENTS } from "../lib/rich-text/events.js";
import {
  blocksKey,
  blocksPlugin,
  blockTurnInto,
  currentTurnInto,
  deleteBlock,
  duplicateBlock,
  insertDivider,
  insertSlashParagraph,
  insertTableBlock,
  moveBlock,
  moveBlockTo,
  runSlashItem,
  selectBlockContent,
  slashMatches,
  topLevelBlock,
  turnInto,
  type TurnIntoKind,
} from "../lib/rich-text/html-blocks.js";
import { usePortalContainer } from "../lib/portal.js";
import type { HtmlEditorExtension, HtmlEditorExtensionSetup, HtmlEditorRenderProps, HtmlSlashItem } from "./html-editor-extension.js";
import type { HtmlEditorViewProps } from "./html-editor-view.js";
import { editorTool, MarkButton, ToolbarSeparator } from "./rich-text-parts.js";

/* ------------------------------------------------------------------ */
/* Slash items                                                         */
/* ------------------------------------------------------------------ */

const runCommand = (command: Command) => (view: EditorView) => {
  command(view.state, view.dispatch, view);
};

const BASIC = "Basic blocks";

/**
 * The blocks extension's slash items: text, headings, lists, quote and
 * code (also offered under "Turn into"), divider, table, image and video.
 */
export const BLOCK_SLASH_ITEMS: HtmlSlashItem[] = [
  { id: "text", label: "Text", description: "Plain paragraph", keywords: ["paragraph", "body", "plain"], icon: <TypeIcon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("paragraph")), turnInto: true },
  { id: "heading-1", label: "Heading 1", description: "Large section title", keywords: ["h1", "title"], icon: <Heading1Icon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("heading1")), turnInto: true },
  { id: "heading-2", label: "Heading 2", description: "Medium section title", keywords: ["h2", "subtitle"], icon: <Heading2Icon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("heading2")), turnInto: true },
  { id: "heading-3", label: "Heading 3", description: "Small section title", keywords: ["h3"], icon: <Heading3Icon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("heading3")), turnInto: true },
  { id: "bulleted-list", label: "Bulleted list", description: "Simple list with bullets", keywords: ["ul", "unordered", "bullets"], icon: <ListIcon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("bullet")), turnInto: true },
  { id: "numbered-list", label: "Numbered list", description: "List with numbers", keywords: ["ol", "ordered", "numbers"], icon: <ListOrderedIcon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("ordered")), turnInto: true },
  { id: "to-do-list", label: "To-do list", description: "Checklist with checkboxes", keywords: ["todo", "task", "checkbox", "checklist"], icon: <ListChecksIcon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("task")), turnInto: true },
  { id: "quote", label: "Quote", description: "Indented quotation", keywords: ["blockquote", "citation"], icon: <TextQuoteIcon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("quote")), turnInto: true },
  { id: "code-block", label: "Code block", description: "Monospaced code", keywords: ["pre", "snippet", "code"], icon: <SquareCodeIcon aria-hidden="true" />, group: BASIC, run: runCommand(turnInto("code")), turnInto: true },
  { id: "divider", label: "Divider", description: "Line between sections", keywords: ["hr", "line", "separator", "rule"], icon: <MinusIcon aria-hidden="true" />, group: BASIC, run: runCommand(insertDivider) },
  { id: "table", label: "Table", description: "3 by 3 table with a header row", keywords: ["grid", "rows", "columns"], icon: <Table2Icon aria-hidden="true" />, group: BASIC, run: runCommand(insertTableBlock(3, 3)) },
  { id: "image", label: "Image", description: "Picture from a link or your computer", keywords: ["picture", "photo", "img", "figure"], icon: <ImageIcon aria-hidden="true" />, group: "Media", run: (view) => void emitEditorEvent(view, RICH_TEXT_EVENTS.openImage) },
  { id: "video", label: "Video", description: "YouTube, Vimeo or Loom link, or a video file", keywords: ["youtube", "vimeo", "loom", "embed", "movie"], icon: <VideoIcon aria-hidden="true" />, group: "Media", run: (view) => void emitEditorEvent(view, RICH_TEXT_EVENTS.openVideo) },
];

const TURN_INTO_IDS: Record<TurnIntoKind, string> = {
  paragraph: "text",
  heading1: "heading-1",
  heading2: "heading-2",
  heading3: "heading-3",
  bullet: "bulleted-list",
  ordered: "numbered-list",
  task: "to-do-list",
  quote: "quote",
  code: "code-block",
};

/** Top-level blocks the block menu offers "Turn into" for. */
const CONVERTIBLE_BLOCKS = new Set(["paragraph", "heading", "code_block", "blockquote", "bullet_list", "ordered_list", "task_list", "callout"]);

const slashOn = (props: HtmlEditorViewProps) => Boolean(props.slashMenu) && !props.compact && !props.readOnly;
const bubbleOn = (props: HtmlEditorViewProps) => Boolean(props.bubbleToolbar) && !props.compact && !props.readOnly;
const handlesOn = (props: HtmlEditorViewProps) => Boolean(props.blockHandles) && !props.compact && !props.readOnly;

/* ------------------------------------------------------------------ */
/* Shared UI state                                                     */
/* ------------------------------------------------------------------ */

/** Where focus is, relative to this editor: its text, the selection toolbar, the block handles, or a popup opened from one of them. */
type FocusZone = "editor" | "bubble" | "handles" | "popup" | null;

interface BlocksUi {
  /** The top-level block under the pointer, for the document it was measured in. */
  hover: { pos: number; doc: ProseMirrorNode } | null;
  /** Start of the block whose menu is open. */
  menu: number | null;
  dragging: boolean;
  zone: FocusZone;
  /** The zone focus came from when it entered a popup. */
  owner: FocusZone;
  /** The primary pointer is down in the text, so a selection is being made. */
  selecting: boolean;
}

interface BlocksController {
  get: () => BlocksUi;
  set: (patch: Partial<BlocksUi>) => void;
  subscribe: (listener: () => void) => () => void;
  items: () => readonly HtmlSlashItem[];
  setItems: (items: readonly HtmlSlashItem[]) => void;
  focusBubble: () => boolean;
  setBubbleFocuser: (focus: (() => boolean) | null) => void;
  attachBubble: (element: HTMLDivElement | null) => void;
  attachHandles: (element: HTMLDivElement | null) => void;
  element: (name: "bubble" | "handles") => HTMLElement | null;
  /** Unique per editor; popups this extension opens carry it as data-blocks-popup. */
  uid: string;
  listboxId: string;
}

let editorCount = 0;

function createController(): BlocksController {
  let ui: BlocksUi = { hover: null, menu: null, dragging: false, zone: null, owner: null, selecting: false };
  const listeners = new Set<() => void>();
  let items: readonly HtmlSlashItem[] = BLOCK_SLASH_ITEMS;
  let focuser: (() => boolean) | null = null;
  const elements: Record<"bubble" | "handles", HTMLElement | null> = { bubble: null, handles: null };
  editorCount += 1;
  const uid = `ai-ui-html-blocks-${editorCount}`;
  return {
    get: () => ui,
    set: (patch) => {
      const keys = Object.keys(patch) as Array<keyof BlocksUi>;
      if (keys.every((key) => ui[key] === patch[key])) return;
      ui = { ...ui, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    items: () => items,
    setItems: (next) => {
      items = next;
    },
    focusBubble: () => focuser?.() ?? false,
    setBubbleFocuser: (focus) => {
      focuser = focus;
    },
    attachBubble: (element) => {
      elements.bubble = element;
    },
    attachHandles: (element) => {
      elements.handles = element;
    },
    element: (name) => elements[name],
    uid,
    listboxId: `${uid}-slash`,
  };
}

function useUi(controller: BlocksController): BlocksUi {
  return useSyncExternalStore(controller.subscribe, controller.get, controller.get);
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Top-level blocks with their rendered boxes, in document order. */
function blockBoxes(view: EditorView): Array<{ pos: number; index: number; rect: DOMRect }> {
  const boxes: Array<{ pos: number; index: number; rect: DOMRect }> = [];
  view.state.doc.forEach((_node, pos, index) => {
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) boxes.push({ pos, index, rect: dom.getBoundingClientRect() });
  });
  return boxes;
}

/** The top-level block closest to a viewport y coordinate. */
function blockAtY(view: EditorView, y: number): number | null {
  let best: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const { pos, rect } of blockBoxes(view)) {
    const gap = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    if (gap < distance) {
      best = pos;
      distance = gap;
    }
  }
  return best;
}

const MEDIA_BLOCKS = new Set(["figure", "embed", "horizontal_rule", "page_break", "toc"]);

/** First text position inside a block, whose line the handles line up with; media blocks use their top edge instead. */
function firstLinePos(node: ProseMirrorNode, pos: number): number | null {
  if (MEDIA_BLOCKS.has(node.type.name)) return null;
  if (node.isTextblock) return pos + 1;
  let found: number | null = null;
  node.descendants((child, offset) => {
    if (found !== null) return false;
    if (child.isTextblock) {
      found = pos + 1 + offset + 1;
      return false;
    }
    return !MEDIA_BLOCKS.has(child.type.name);
  });
  return found;
}

/** The visible part of the surface in viewport coordinates. */
function visibleBox(surface: HTMLElement): { top: number; bottom: number; left: number; right: number } {
  const box = surface.getBoundingClientRect();
  return { top: Math.max(box.top, 0), bottom: Math.min(box.bottom, window.innerHeight || box.bottom), left: box.left, right: box.left + surface.clientWidth };
}

function setPosition(element: HTMLElement, surface: HTMLElement, left: number, top: number): void {
  const box = surface.getBoundingClientRect();
  element.style.left = `${Math.round(left - box.left + surface.scrollLeft)}px`;
  element.style.top = `${Math.round(top - box.top + surface.scrollTop)}px`;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

/** Repositions floating parts when anything scrolls or the window resizes. */
function useReposition(place: () => void, active: boolean): void {
  const latest = useRef(place);
  useLayoutEffect(() => {
    latest.current = place;
  });
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          latest.current();
        });
    };
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [active]);
}

/* ------------------------------------------------------------------ */
/* Slash menu                                                          */
/* ------------------------------------------------------------------ */

interface PartProps extends HtmlEditorRenderProps {
  controller: BlocksController;
}

function SlashMenu({ state, viewRef, surfaceRef, slashItems, controller }: PartProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const open = slashMatches(state, slashItems);
  const active = open ? Math.min(open.slash.index, open.matches.length - 1) : 0;

  const place = () => {
    const list = listRef.current;
    const view = viewRef.current;
    const surface = surfaceRef.current;
    const slash = view ? blocksKey.getState(view.state)?.slash : null;
    if (!list || !view || !surface || !slash) return;
    const caret = view.coordsAtPos(slash.from);
    const visible = visibleBox(surface);
    const below = visible.bottom - caret.bottom - 12;
    const above = caret.top - visible.top - 12;
    list.style.maxHeight = `${clamp(Math.max(below, above), 120, 320)}px`;
    const height = list.offsetHeight;
    const top = below >= Math.min(height, 200) || below >= above ? caret.bottom + 6 : caret.top - 6 - height;
    setPosition(list, surface, clamp(caret.left - 12, visible.left + 8, visible.right - list.offsetWidth - 8), top);
    const option = list.querySelector<HTMLElement>('[aria-selected="true"]');
    if (option) {
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop - 4;
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight + 4;
    }
  };

  useLayoutEffect(place);
  useReposition(place, Boolean(open));

  if (!open) return null;
  const sections: Array<{ group: string; entries: Array<{ item: HtmlSlashItem; index: number }> }> = [];
  open.matches.forEach((item, index) => {
    const last = sections.at(-1);
    if (last && last.group === item.group) last.entries.push({ item, index });
    else sections.push({ group: item.group, entries: [{ item, index }] });
  });
  const id = controller.listboxId;
  const choose = (item: HtmlSlashItem) => {
    const view = viewRef.current;
    if (view) runSlashItem(view, item);
  };
  const highlight = (index: number) => {
    const view = viewRef.current;
    if (view && index !== active) view.dispatch(view.state.tr.setMeta(blocksKey, { type: "index", index }));
  };

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label="Insert block"
      aria-activedescendant={`${id}-${active}`}
      data-blocks-floating=""
      // A scrolling region has to be focusable; the arrow keys work in the text, so focus goes straight back there.
      tabIndex={0}
      onFocus={() => viewRef.current?.focus()}
      onMouseDown={(event) => event.preventDefault()}
      className={cn(popupSurface, "absolute top-0 left-0 z-30 flex w-72 max-w-[calc(100%-1rem)] flex-col overflow-y-auto p-1 text-sm")}
    >
      {sections.map((section, sectionIndex) => (
        <div key={`${sectionIndex}-${section.group}`} role="group" aria-labelledby={`${id}-group-${sectionIndex}`} className="flex flex-col">
          <div id={`${id}-group-${sectionIndex}`} className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
            {section.group}
          </div>
          {section.entries.map(({ item, index }) => (
            <div
              key={`${index}-${item.id}`}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => highlight(index)}
              onClick={() => choose(item)}
              className="flex cursor-default items-center gap-3 rounded-md px-2 py-1.5 aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground [&_svg]:size-4">
                {item.icon}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{item.label}</span>
                {item.description && <span className="truncate text-xs text-muted-foreground">{item.description}</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Turn into                                                           */
/* ------------------------------------------------------------------ */

const menuItem =
  "flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";
const menuPopup = cn(popupSurface, "max-h-[var(--available-height)] min-w-48 overflow-y-auto p-1 outline-none");

/** The turn-into items as menu radio items, the current kind checked. */
function TurnIntoItems({ items, current, onPick }: { items: HtmlSlashItem[]; current: string | null; onPick: (item: HtmlSlashItem) => void }) {
  return (
    <Menu.RadioGroup
      value={current ?? ""}
      onValueChange={(value: string) => {
        const item = items.find((entry) => entry.id === value);
        if (item) onPick(item);
      }}
    >
      {items.map((item) => (
        <Menu.RadioItem key={item.id} value={item.id} closeOnClick className={menuItem}>
          <span className="flex size-4 items-center justify-center">
            <Menu.RadioItemIndicator>
              <CheckIcon aria-hidden="true" />
            </Menu.RadioItemIndicator>
          </span>
          <span aria-hidden="true" className="flex text-muted-foreground">
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
        </Menu.RadioItem>
      ))}
    </Menu.RadioGroup>
  );
}

const turnIntoItems = (items: readonly HtmlSlashItem[]) => items.filter((item) => item.turnInto);
const kindId = (kind: TurnIntoKind | null) => (kind ? TURN_INTO_IDS[kind] : null);

/* ------------------------------------------------------------------ */
/* Selection toolbar                                                   */
/* ------------------------------------------------------------------ */

function BubbleToolbar({ state, viewRef, run, surfaceRef, slashItems, bubbleItems, controller }: PartProps) {
  const ui = useUi(controller);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const picked = useRef(false);
  const container = usePortalContainer();
  const { selection } = state;
  const marks = state.schema.marks;
  const inCode = Boolean(selection.$from.parent.type.spec.code || selection.$to.parent.type.spec.code);
  const hasText = selection instanceof TextSelection && !selection.empty && state.doc.textBetween(selection.from, selection.to, " ", " ").trim().length > 0;
  const focused = ui.zone === "editor" || ui.zone === "bubble" || (ui.zone === "popup" && (ui.owner === "editor" || ui.owner === "bubble"));
  const visible = hasText && !inCode && focused && !ui.selecting && ui.menu === null && !ui.dragging;
  const items = turnIntoItems(slashItems);
  const current = kindId(currentTurnInto(state));
  const currentLabel = items.find((item) => item.id === current)?.label;

  const place = () => {
    const toolbar = toolbarRef.current;
    const view = viewRef.current;
    const surface = surfaceRef.current;
    if (!toolbar || !view || !surface || toolbar.dataset.open !== "true") return;
    const { from, to } = view.state.selection;
    const start = view.coordsAtPos(from, 1);
    const end = view.coordsAtPos(to, -1);
    const visibleArea = visibleBox(surface);
    const width = toolbar.offsetWidth;
    const height = toolbar.offsetHeight;
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    let y = top - height - 8;
    let side = "top";
    if (y < visibleArea.top + 4) {
      y = bottom + 8;
      side = "bottom";
      if (y + height > visibleArea.bottom - 4) y = clamp(top - height - 8, visibleArea.top + 4, visibleArea.bottom - height - 4);
    }
    const x = Math.abs(start.top - end.top) < 4 ? (start.left + end.left) / 2 - width / 2 : start.left - 8;
    setPosition(toolbar, surface, clamp(x, visibleArea.left + 4, visibleArea.right - width - 4), y);
    toolbar.dataset.side = side;
  };

  useLayoutEffect(place);
  useReposition(place, visible);

  useEffect(() => {
    controller.setBubbleFocuser(() => {
      const toolbar = toolbarRef.current;
      if (!toolbar || toolbar.dataset.open !== "true") return false;
      const first = toolbar.querySelector<HTMLElement>("button:not([disabled]):not([aria-disabled='true'])");
      first?.focus();
      return Boolean(first);
    });
    return () => controller.setBubbleFocuser(null);
  }, [controller]);

  useEffect(() => {
    // The host creates the view after its children's effects run, so listen on the surface and check the target when it happens.
    const surface = surfaceRef.current;
    if (!surface) return;
    const down = (event: PointerEvent) => {
      if (event.button === 0 && event.target instanceof Node && viewRef.current?.dom.contains(event.target)) controller.set({ selecting: true });
    };
    const up = () => controller.set({ selecting: false });
    surface.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      surface.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
    };
  }, [controller, surfaceRef, viewRef]);

  const setToolbar = (element: HTMLDivElement | null) => {
    toolbarRef.current = element;
    controller.attachBubble(element);
  };

  return (
    <Toolbar.Root
      ref={setToolbar}
      aria-label="Format selection"
      data-blocks-floating=""
      data-open={visible ? "true" : "false"}
      hidden={!visible}
      onMouseDown={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !(event.target instanceof Node) || !toolbarRef.current?.contains(event.target)) return;
        event.preventDefault();
        viewRef.current?.focus();
      }}
      className="absolute top-0 left-0 z-30 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <MarkButton label="Bold" type={marks.strong!} icon={<BoldIcon aria-hidden="true" />} shortcut="Ctrl+B" state={state} run={run} />
      <MarkButton label="Italic" type={marks.em!} icon={<ItalicIcon aria-hidden="true" />} shortcut="Ctrl+I" state={state} run={run} />
      <MarkButton label="Underline" type={marks.underline!} icon={<UnderlineIcon aria-hidden="true" />} shortcut="Ctrl+U" state={state} run={run} />
      <MarkButton label="Strikethrough" type={marks.strike!} icon={<StrikethroughIcon aria-hidden="true" />} shortcut="Ctrl+Shift+X" state={state} run={run} />
      <MarkButton label="Inline code" type={marks.code!} icon={<CodeIcon aria-hidden="true" />} shortcut="Ctrl+E" state={state} run={run} />
      <Toolbar.Button
        aria-label="Link"
        title="Link (Ctrl+K)"
        aria-keyshortcuts="Control+K"
        aria-pressed={isMarkActive(state, marks.link!)}
        onClick={() => emitEditorEvent(viewRef.current ?? undefined, RICH_TEXT_EVENTS.openLink)}
        className={editorTool}
      >
        <LinkIcon aria-hidden="true" />
      </Toolbar.Button>
      {items.length > 0 && (
        <>
          <ToolbarSeparator />
          <Menu.Root
            onOpenChange={(open) => {
              if (open) picked.current = false;
            }}
          >
            <Menu.Trigger
              render={
                <Toolbar.Button className={cn(editorTool, "w-auto gap-1 px-2 text-sm text-foreground")}>
                  <span className="sr-only">Turn into: </span>
                  {currentLabel ?? "Turn into"}
                  <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
                </Toolbar.Button>
              }
            />
            <Menu.Portal container={container}>
              <Menu.Positioner sideOffset={6} align="start" className="z-50">
                <Menu.Popup aria-label="Turn into" data-blocks-popup={controller.uid} finalFocus={() => (picked.current ? (viewRef.current?.dom ?? true) : true)} className={menuPopup}>
                  <TurnIntoItems
                    items={items}
                    current={current}
                    onPick={(item) => {
                      const view = viewRef.current;
                      if (!view) return;
                      picked.current = true;
                      item.run(view);
                    }}
                  />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>
      )}
      <div className="ml-0.5 flex items-center gap-0.5 border-l border-border pl-1 empty:hidden">{bubbleItems}</div>
    </Toolbar.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Block handles                                                       */
/* ------------------------------------------------------------------ */

const handleButton = cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-4", focusRing);

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  y: number;
  pos: number;
  active: boolean;
  gap: number | null;
  frame: number;
  dispose: () => void;
}

interface BlockMenuProps {
  block: { pos: number; node: ProseMirrorNode; index: number };
  /** Top-level blocks in the document, to know whether this one is last. */
  count: number;
  anchor: RefObject<HTMLButtonElement | null>;
  viewRef: RefObject<EditorView | null>;
  slashItems: HtmlSlashItem[];
  setStatus: (message: string) => void;
  controller: BlocksController;
}

function BlockMenu({ block, count, anchor, viewRef, slashItems, setStatus, controller }: BlockMenuProps) {
  const ui = useUi(controller);
  const container = usePortalContainer();
  const open = ui.menu === block.pos;
  const items = turnIntoItems(slashItems);
  const convertible = CONVERTIBLE_BLOCKS.has(block.node.type.name) && items.length > 0;

  const act = (command: Command, message: string) => {
    const view = viewRef.current;
    if (view && command(view.state, view.dispatch, view)) setStatus(message);
  };
  const turn = (item: HtmlSlashItem) => {
    const view = viewRef.current;
    if (!view) return;
    selectBlockContent(block.pos)(view.state, view.dispatch);
    item.run(view);
    const { selection } = view.state;
    if (!selection.empty) view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(selection.to), -1)));
    setStatus(`Turned into ${item.label}`);
  };
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) controller.set({ menu: null });
      }}
    >
      <Menu.Portal container={container}>
        <Menu.Positioner anchor={anchor} side="bottom" align="start" sideOffset={4} className="z-50">
          <Menu.Popup aria-label="Block actions" data-blocks-popup={controller.uid} finalFocus={() => viewRef.current?.dom ?? true} className={menuPopup}>
            <Menu.SubmenuRoot disabled={!convertible}>
              <Menu.SubmenuTrigger className={menuItem}>
                <Repeat2Icon aria-hidden="true" />
                <span className="flex-1">Turn into</span>
                <ChevronRightIcon aria-hidden="true" className="text-muted-foreground" />
              </Menu.SubmenuTrigger>
              <Menu.Portal container={container}>
                <Menu.Positioner sideOffset={4} className="z-50">
                  <Menu.Popup aria-label="Turn into" data-blocks-popup={controller.uid} className={menuPopup}>
                    <TurnIntoItems items={items} current={kindId(blockTurnInto(block.node))} onPick={turn} />
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
            <Menu.Item onClick={() => act(duplicateBlock(block.pos), "Duplicated block")} className={menuItem}>
              <CopyIcon aria-hidden="true" />
              <span className="flex-1">Duplicate</span>
            </Menu.Item>
            <Menu.Item disabled={block.index === 0} aria-keyshortcuts="Alt+Shift+ArrowUp" onClick={() => act(moveBlock(block.pos, -1), "Moved block up")} className={menuItem}>
              <ArrowUpIcon aria-hidden="true" />
              <span className="flex-1">Move up</span>
              <kbd className="font-sans text-xs text-muted-foreground">Alt+Shift+↑</kbd>
            </Menu.Item>
            <Menu.Item disabled={block.index >= count - 1} aria-keyshortcuts="Alt+Shift+ArrowDown" onClick={() => act(moveBlock(block.pos, 1), "Moved block down")} className={menuItem}>
              <ArrowDownIcon aria-hidden="true" />
              <span className="flex-1">Move down</span>
              <kbd className="font-sans text-xs text-muted-foreground">Alt+Shift+↓</kbd>
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item onClick={() => act(deleteBlock(block.pos), "Deleted block")} className={cn(menuItem, "text-destructive data-[highlighted]:text-destructive")}>
              <Trash2Icon aria-hidden="true" />
              <span className="flex-1">Delete</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Whether `pos` is the start of a top-level block. */
function isBlockStart(doc: ProseMirrorNode, pos: number): boolean {
  if (pos < 0 || pos >= doc.content.size) return false;
  return doc.resolve(pos).depth === 0 && doc.nodeAt(pos) !== null;
}

function BlockHandles({ state, viewRef, run, surfaceRef, slashItems, setStatus, controller }: PartProps) {
  const ui = useUi(controller);
  const gripRef = useRef<HTMLButtonElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const session = useRef<DragSession | null>(null);
  const suppressClick = useRef(false);
  const describedBy = useId();
  const dragging = blocksKey.getState(state)?.dragging ?? null;
  const hover = ui.hover && ui.hover.doc === state.doc ? ui.hover.pos : null;
  const menu = ui.menu !== null && isBlockStart(state.doc, ui.menu) ? ui.menu : null;
  const cursor = ui.zone === "editor" || ui.zone === "handles" ? (topLevelBlock(state.doc, state.selection.from)?.pos ?? null) : null;
  const target = dragging ?? menu ?? hover ?? cursor;
  const block = target !== null && isBlockStart(state.doc, target) ? topLevelBlock(state.doc, target) : null;

  const place = () => {
    const element = controller.element("handles");
    const view = viewRef.current;
    const surface = surfaceRef.current;
    if (!element || !view || !surface || !block) return;
    const dom = view.nodeDOM(block.pos);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    let top = rect.top;
    let bottom = rect.top + Math.min(rect.height, 28);
    const line = firstLinePos(block.node, block.pos);
    if (line !== null) {
      const coords = view.coordsAtPos(line);
      top = coords.top;
      bottom = coords.bottom;
    }
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const box = surface.getBoundingClientRect();
    setPosition(element, surface, Math.max(box.left + 2, rect.left - width - 4), (top + bottom) / 2 - height / 2);
  };

  useLayoutEffect(place);
  useReposition(place, block !== null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    let frame = 0;
    let y = 0;
    const update = () => {
      frame = 0;
      const view = viewRef.current;
      if (!view) return;
      const pos = blockAtY(view, y);
      controller.set({ hover: pos === null ? null : { pos, doc: view.state.doc } });
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || session.current) return;
      if (event.target instanceof Element && event.target.closest("[data-blocks-floating]")) return;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      controller.set({ hover: null });
    };
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", leave);
    };
  }, [controller, surfaceRef, viewRef]);

  useEffect(() => () => session.current?.dispose(), []);

  /** Finds the gap the pointer is over and draws the drop line there; a gap next to the block itself shows nothing. */
  const updateDrop = (drag: DragSession) => {
    const view = viewRef.current;
    const surface = surfaceRef.current;
    const line = lineRef.current;
    if (!view || !surface || !line) return;
    const boxes = blockBoxes(view);
    const source = topLevelBlock(view.state.doc, drag.pos);
    const first = boxes[0];
    const last = boxes.at(-1);
    if (!source || !first || !last) return;
    const found = boxes.find((entry) => drag.y < entry.rect.top + entry.rect.height / 2);
    const gap = found ? found.index : view.state.doc.childCount;
    drag.gap = gap === source.index || gap === source.index + 1 ? null : gap;
    line.hidden = drag.gap === null;
    if (drag.gap === null) return;
    const before = boxes.find((entry) => entry.index === gap - 1)?.rect;
    const after = found?.rect;
    const y = before && after ? (before.bottom + after.top) / 2 : after ? after.top - 2 : last.rect.bottom + 2;
    const style = getComputedStyle(view.dom);
    const content = view.dom.getBoundingClientRect();
    const left = content.left + (Number.parseFloat(style.paddingLeft) || 0);
    const right = content.right - (Number.parseFloat(style.paddingRight) || 0);
    line.style.width = `${Math.max(0, right - left)}px`;
    setPosition(line, surface, left, y - 1);
  };

  const endDrag = (commit: boolean) => {
    const drag = session.current;
    const view = viewRef.current;
    if (!drag) return;
    session.current = null;
    drag.dispose();
    if (lineRef.current) lineRef.current.hidden = true;
    if (!drag.active || !view) return;
    suppressClick.current = true;
    view.dispatch(view.state.tr.setMeta(blocksKey, { type: "drag", pos: null }));
    controller.set({ dragging: false });
    const source = topLevelBlock(view.state.doc, drag.pos);
    if (!commit || drag.gap === null || !source) {
      if (!commit) setStatus("Move canceled");
      return;
    }
    if (moveBlockTo(source.pos, drag.gap)(view.state, view.dispatch)) setStatus(drag.gap < source.index ? "Moved block up" : "Moved block down");
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const view = viewRef.current;
    const surface = surfaceRef.current;
    if (event.button !== 0 || !block || !view || !surface || session.current) return;
    event.preventDefault();
    const grip = event.currentTarget;
    const pointerId = event.pointerId;
    if (grip.setPointerCapture) {
      try {
        grip.setPointerCapture(pointerId);
      } catch {
        // The pointer may already be gone, as with synthetic events; dragging then follows the listeners below.
      }
    }
    const scroll = () => {
      const drag = session.current;
      if (!drag?.active) return;
      const box = surface.getBoundingClientRect();
      const edge = 40;
      const delta = drag.y < box.top + edge ? -(box.top + edge - drag.y) / 3 : drag.y > box.bottom - edge ? (drag.y - box.bottom + edge) / 3 : 0;
      if (delta) {
        surface.scrollTop += delta;
        updateDrop(drag);
      }
      drag.frame = requestAnimationFrame(scroll);
    };
    const move = (moved: PointerEvent) => {
      const drag = session.current;
      if (!drag || moved.pointerId !== pointerId) return;
      drag.y = moved.clientY;
      if (!drag.active) {
        if (Math.hypot(moved.clientX - drag.startX, moved.clientY - drag.startY) < 4) return;
        drag.active = true;
        controller.set({ dragging: true, menu: null });
        view.dispatch(view.state.tr.setMeta(blocksKey, { type: "drag", pos: drag.pos }));
        drag.frame = requestAnimationFrame(scroll);
      }
      updateDrop(drag);
    };
    const up = (released: PointerEvent) => {
      if (released.pointerId === pointerId) endDrag(true);
    };
    const cancel = () => endDrag(false);
    const key = (pressed: KeyboardEvent) => {
      if (pressed.key !== "Escape") return;
      pressed.preventDefault();
      pressed.stopPropagation();
      endDrag(false);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    session.current = {
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      y: event.clientY,
      pos: block.pos,
      active: false,
      gap: null,
      frame: 0,
      dispose: () => {
        const drag = session.current;
        if (drag) cancelAnimationFrame(drag.frame);
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
        grip.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key, true);
        if (grip.hasPointerCapture?.(pointerId)) grip.releasePointerCapture(pointerId);
      },
    };
  };

  if (!block) return null;
  const label = block.node.type.name.replace(/_/g, " ");
  const attach = (element: HTMLDivElement | null) => controller.attachHandles(element);

  return (
    <>
      <div ref={attach} data-blocks-handles="" className="absolute top-0 left-0 z-20 flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Add block below"
          title="Add block below (Alt-click adds above)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => run(insertSlashParagraph(block.pos, event.altKey ? "above" : "below"))}
          className={handleButton}
        >
          <PlusIcon aria-hidden="true" />
        </button>
        <button
          ref={gripRef}
          type="button"
          aria-label="Block actions"
          aria-haspopup="menu"
          aria-expanded={menu === block.pos}
          aria-describedby={describedBy}
          title="Drag to move, click for actions"
          onPointerDown={startDrag}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            controller.set({ menu: menu === block.pos ? null : block.pos });
          }}
          onKeyDown={(event) => {
            if (!event.altKey || !event.shiftKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
            event.preventDefault();
            const view = viewRef.current;
            const direction = event.key === "ArrowUp" ? -1 : 1;
            if (view && moveBlock(block.pos, direction)(view.state, view.dispatch)) setStatus(`Moved block ${direction < 0 ? "up" : "down"}`);
          }}
          className={cn(handleButton, "cursor-grab touch-none active:cursor-grabbing")}
        >
          <GripVerticalIcon aria-hidden="true" />
        </button>
        <span id={describedBy} hidden>
          {`${label.charAt(0).toUpperCase()}${label.slice(1)}. Drag to move, or press Enter for block actions. Alt+Shift+Up or Down arrow moves the block.`}
        </span>
      </div>
      <div ref={lineRef} aria-hidden="true" hidden className="pointer-events-none absolute top-0 left-0 z-20 h-0.5 rounded-full bg-primary" />
      <BlockMenu block={block} count={state.doc.childCount} anchor={gripRef} viewRef={viewRef} slashItems={slashItems} setStatus={setStatus} controller={controller} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Extension                                                           */
/* ------------------------------------------------------------------ */

/**
 * Tracks which part of this editor holds focus, so floating parts stay
 * while focus is in them or in a popup this extension opened. Popups from
 * other features (link dialog, comments, AI) count as elsewhere.
 */
function useFocusZones(controller: BlocksController, viewRef: RefObject<EditorView | null>): void {
  useEffect(() => {
    const classify = (target: EventTarget | null): FocusZone => {
      const view = viewRef.current;
      if (!(target instanceof Element) || !view) return null;
      if (view.dom.contains(target)) return "editor";
      if (controller.element("bubble")?.contains(target)) return "bubble";
      if (controller.element("handles")?.contains(target)) return "handles";
      if (target.closest(`[data-blocks-popup="${controller.uid}"]`)) return "popup";
      return null;
    };
    const enter = (zone: FocusZone) => {
      const current = controller.get();
      controller.set(zone === "popup" ? { zone, owner: current.zone === "popup" ? current.owner : current.zone } : { zone, owner: null });
    };
    const focusIn = (event: FocusEvent) => enter(classify(event.target));
    const focusOut = (event: FocusEvent) => {
      if (!event.relatedTarget) enter(null);
    };
    enter(classify(document.activeElement));
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    return () => {
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
    };
  }, [controller, viewRef]);
}

function BlocksOverlay(props: PartProps) {
  const { controller, slashItems, viewRef, readOnly, locked, props: editorProps } = props;
  useEffect(() => controller.setItems(slashItems), [controller, slashItems]);
  useFocusZones(controller, viewRef);
  if (readOnly || locked || editorProps.compact) return null;
  return (
    <>
      {slashOn(editorProps) && <SlashMenu {...props} />}
      {bubbleOn(editorProps) && <BubbleToolbar {...props} />}
      {handlesOn(editorProps) && <BlockHandles {...props} />}
    </>
  );
}

/** Left padding that makes room for the block handles in the default layout; page layout brings its own margin. */
const HANDLE_GUTTER = "[&>.ProseMirror]:pl-16";

/**
 * Notion-style editing for HtmlEditorView: a "/" menu of blocks from every
 * extension, a selection toolbar with marks, link, "Turn into" and other
 * extensions' buttons (Alt+F10 focuses it), and block handles to add a
 * block, drag one or open its menu (Ctrl+/), with Alt+Shift+Arrow keys to
 * move blocks. Follows the slashMenu, bubbleToolbar and blockHandles props.
 */
export function createBlocksExtension(setup: HtmlEditorExtensionSetup): HtmlEditorExtension {
  const controller = createController();
  const plugin = blocksPlugin({
    slashMenu: () => slashOn(setup.getProps()),
    blockHandles: () => handlesOn(setup.getProps()),
    bubbleToolbar: () => bubbleOn(setup.getProps()),
    items: () => controller.items(),
    listboxId: controller.listboxId,
    openBlockMenu: (pos) => {
      controller.set({ menu: pos, hover: null });
      return true;
    },
    focusBubble: () => controller.focusBubble(),
    announce: (message) => setup.setStatus(message),
    hint: "Type / for blocks",
  });
  function Overlay(props: HtmlEditorRenderProps): ReactNode {
    return <BlocksOverlay {...props} controller={controller} />;
  }
  return {
    name: "blocks",
    plugins: [plugin],
    slashItems: BLOCK_SLASH_ITEMS,
    surfaceClassName: (props) => (handlesOn(props) && props.layout !== "page" ? HANDLE_GUTTER : undefined),
    Overlay,
  };
}
