// packages/ai-ui/src/components/design-editor.tsx
"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import {
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  DiamondIcon,
  DownloadIcon,
  HandIcon,
  ImageIcon,
  MinusIcon,
  MousePointer2Icon,
  Redo2Icon,
  SquareIcon,
  StarIcon,
  TriangleIcon,
  TypeIcon,
  Undo2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import {
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadBlob as download } from "../lib/download.js";
import {
  type Alignment,
  alignElements,
  type Arrange,
  arrangeElements,
  type Box,
  boxCenter,
  boxesIntersect,
  type Design,
  type DesignElement,
  type DesignElementKind,
  type DesignPage,
  distributeElements,
  elementAt,
  elementBounds,
  elementCorners,
  type Guide,
  type Handle,
  isLinear,
  type Point,
  resizeElement,
  rotatePoint,
  rotationFor,
  round,
  scaleElements,
  snapBox,
  unionBounds,
  wrapText,
} from "../lib/design/geometry.js";
import { ActionMenu } from "./action-menu.js";
import { elementLabel, LayersPanel, PagesPanel, PropertiesPanel } from "./design-editor-panels.js";
import { DesignPageSvg } from "./design-page-svg.js";

export type DesignTool = "select" | "hand" | Exclude<DesignElementKind, "image">;

const TOOLS: Array<{ tool: DesignTool; label: string; key: string; icon: ReactNode }> = [
  { tool: "select", label: "Select", key: "V", icon: <MousePointer2Icon aria-hidden="true" /> },
  { tool: "hand", label: "Hand", key: "H", icon: <HandIcon aria-hidden="true" /> },
  { tool: "rect", label: "Rectangle", key: "R", icon: <SquareIcon aria-hidden="true" /> },
  { tool: "ellipse", label: "Ellipse", key: "O", icon: <CircleIcon aria-hidden="true" /> },
  { tool: "triangle", label: "Triangle", key: "", icon: <TriangleIcon aria-hidden="true" /> },
  { tool: "diamond", label: "Diamond", key: "", icon: <DiamondIcon aria-hidden="true" /> },
  { tool: "star", label: "Star", key: "", icon: <StarIcon aria-hidden="true" /> },
  { tool: "line", label: "Line", key: "L", icon: <MinusIcon aria-hidden="true" /> },
  { tool: "arrow", label: "Arrow", key: "A", icon: <ArrowUpRightIcon aria-hidden="true" /> },
  { tool: "text", label: "Text", key: "T", icon: <TypeIcon aria-hidden="true" /> },
];

const DEFAULTS: Record<Exclude<DesignElementKind, "image">, Partial<DesignElement> & { width: number; height: number }> = {
  rect: { width: 240, height: 160, fill: "#3987e5", radius: 12 },
  ellipse: { width: 200, height: 200, fill: "#d95926" },
  triangle: { width: 220, height: 190, fill: "#199e70" },
  diamond: { width: 200, height: 200, fill: "#9085e9" },
  star: { width: 220, height: 220, fill: "#c98500" },
  line: { width: 240, height: 0, stroke: "#111111", strokeWidth: 4 },
  arrow: { width: 240, height: 0, stroke: "#111111", strokeWidth: 4 },
  text: { width: 360, height: 48, text: "Add a heading", fontSize: 40, fontWeight: 700, color: "#111111" },
};

const HISTORY_LIMIT = 100;
const PADDING = 48;
const MAX_IMAGE_SIDE = 1600;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const DEFAULT_DESIGN: Design = { width: 1080, height: 1080, pages: [{ id: "page-1", name: "", background: "#ffffff", elements: [] }] };

type Drag =
  | { mode: "move"; origin: Point; start: DesignElement[]; moved: boolean }
  | { mode: "resize"; handle: Handle; start: DesignElement[]; box: Box; keepAspect: boolean }
  | { mode: "rotate"; start: DesignElement }
  | { mode: "line-end"; end: "start" | "end"; start: DesignElement }
  | { mode: "create"; kind: Exclude<DesignElementKind, "image">; origin: Point }
  | { mode: "marquee"; origin: Point; additive: boolean; base: string[] }
  | { mode: "pan"; client: Point; scroll: Point };

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function textHeight(element: DesignElement): number {
  const fontSize = element.fontSize ?? 24;
  const lines = wrapText(element.text ?? "", element.width, { fontSize, fontWeight: element.fontWeight ?? 400, fontFamily: element.fontFamily ?? "system-ui, sans-serif" });
  return round(Math.max(1, lines.length) * (element.lineHeight ?? 1.25) * fontSize + fontSize * 0.2);
}

async function readImage(file: File): Promise<{ src: string; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 8 MB or smaller.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot process images.");
    context.drawImage(image, 0, 0, width, height);
    const src = canvas.toDataURL(file.type === "image/png" || file.type === "image/svg+xml" ? "image/png" : "image/jpeg", 0.88);
    return { src, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function serializeSvg(svg: SVGSVGElement, width: number, height: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-overlay]").forEach((node) => node.remove());
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  for (const attribute of [...clone.attributes]) if (attribute.name.startsWith("aria-") || attribute.name === "role") clone.removeAttribute(attribute.name);
  return new XMLSerializer().serializeToString(clone);
}

export interface DesignEditorProps extends Omit<ComponentProps<"div">, "defaultValue" | "onChange"> {
  design?: Design;
  defaultDesign?: Design;
  onDesignChange?: (design: Design) => void;
  /** Viewer mode: pages only, no editing. */
  readOnly?: boolean;
  /** Height of the editor. */
  height?: number | string;
  /** Used for export file names. */
  title?: string;
  label?: string;
}

/**
 * Design canvas for social posts, flyers and slides: pages, shapes, lines
 * and arrows, wrapped text, images, move, resize and rotate handles with
 * smart guides, marquee and multi-select, align and distribute, layers with
 * hide and lock, a properties panel, undo, keyboard control and PNG, SVG
 * and JSON export. Renders to SVG with no canvas library.
 */
export function DesignEditor({ design: designProp, defaultDesign = DEFAULT_DESIGN, onDesignChange, readOnly = false, height = "36rem", title = "Design", label = "Design canvas", className, ...props }: DesignEditorProps) {
  const [design, setDesign] = useControllableState({ value: designProp, defaultValue: defaultDesign, onChange: onDesignChange });
  const [pageId, setPageId] = useState(() => design.pages[0]?.id ?? "page-1");
  const foundPage = design.pages.findIndex((page) => page.id === pageId);
  const pageIndex = foundPage === -1 ? 0 : foundPage;
  const page = design.pages[pageIndex] ?? DEFAULT_DESIGN.pages[0]!;
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<DesignTool>("select");
  const [zoomSetting, setZoomSetting] = useState<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 520 });
  const [history, setHistory] = useState<{ past: Design[]; future: Design[] }>({ past: [], future: [] });
  const [preview, setPreview] = useState<DesignElement[] | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [draft, setDraft] = useState<DesignElement | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const clipboardRef = useRef<DesignElement[]>([]);
  const replaceTargetRef = useRef<string | null>(null);
  const id = useId();

  const fitZoom = Math.max(0.05, Math.min((viewportSize.width - PADDING * 2) / design.width, (viewportSize.height - PADDING * 2) / design.height));
  const zoom = zoomSetting ?? fitZoom;
  const elements = preview ?? page.elements;
  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const selected = elements.filter((element) => selectedSet.has(element.id));
  const selectionBounds = unionBounds(selected.map(elementBounds));

  /* ---------------- history ---------------- */

  const commit = (next: Design) => {
    setHistory((current) => ({ past: [...current.past.slice(-(HISTORY_LIMIT - 1)), design], future: [] }));
    setDesign(next);
  };
  const commitElements = (next: DesignElement[]) => commit({ ...design, pages: design.pages.map((item, index) => (index === pageIndex ? { ...item, elements: next } : item)) });
  const updateSelected = (update: (element: DesignElement) => DesignElement) => commitElements(page.elements.map((element) => (selectedSet.has(element.id) ? update(element) : element)));
  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [design, ...history.future] });
    setDesign(previous);
    setAnnouncement("Undone");
  };
  const redo = () => {
    const next = history.future[0];
    if (!next) return;
    setHistory({ past: [...history.past, design], future: history.future.slice(1) });
    setDesign(next);
    setAnnouncement("Redone");
  };

  /* ---------------- viewport ---------------- */

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setViewportSize({ width: element.clientWidth || 800, height: element.clientHeight || 520 }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoomTo = (next: number, focus?: { clientX: number; clientY: number }) => {
    const element = viewportRef.current;
    const clamped = Math.min(8, Math.max(0.05, next));
    if (element && focus) {
      const rect = element.getBoundingClientRect();
      const pageX = (element.scrollLeft + focus.clientX - rect.left - PADDING) / zoom;
      const pageY = (element.scrollTop + focus.clientY - rect.top - PADDING) / zoom;
      requestAnimationFrame(() => {
        element.scrollLeft = pageX * clamped + PADDING - (focus.clientX - rect.left);
        element.scrollTop = pageY * clamped + PADDING - (focus.clientY - rect.top);
      });
    }
    setZoomSetting(clamped);
  };

  const zoomToRef = useRef(zoomTo);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomToRef.current = zoomTo;
    zoomRef.current = zoom;
  });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomToRef.current(zoomRef.current * Math.exp(-event.deltaY * 0.002), { clientX: event.clientX, clientY: event.clientY });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);
  const toPage = (clientX: number, clientY: number): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * design.width, y: ((clientY - rect.top) / rect.height) * design.height };
  };

  /* ---------------- element commands ---------------- */

  const select = (ids: string[]) => {
    setSelection(ids);
    const items = page.elements.filter((element) => ids.includes(element.id));
    setAnnouncement(items.length === 0 ? "Selection cleared" : items.length === 1 ? `${elementLabel(items[0]!)} selected` : `${items.length} elements selected`);
  };

  const addElement = (element: DesignElement) => {
    commitElements([...page.elements, element]);
    setSelection([element.id]);
    setAnnouncement(`${elementLabel(element)} added`);
  };

  const createAt = (kind: Exclude<DesignElementKind, "image">, center: Point): DesignElement => {
    const defaults = DEFAULTS[kind];
    const element: DesignElement = { id: newId(kind), kind, ...defaults, x: round(center.x - defaults.width / 2), y: round(center.y - defaults.height / 2), width: defaults.width, height: defaults.height };
    return kind === "text" ? { ...element, height: textHeight(element) } : element;
  };

  const deleteSelected = () => {
    const removable = selected.filter((element) => !element.locked);
    if (removable.length === 0) return;
    const ids = new Set(removable.map((element) => element.id));
    commitElements(page.elements.filter((element) => !ids.has(element.id)));
    setSelection([]);
    setAnnouncement(`${removable.length === 1 ? elementLabel(removable[0]!) : `${removable.length} elements`} deleted`);
  };

  const duplicate = (items: DesignElement[] = selected, offset = 24) => {
    if (items.length === 0) return;
    const copies = items.map((element) => ({ ...element, id: newId(element.kind), x: element.x + offset, y: element.y + offset, locked: false }));
    commitElements([...page.elements, ...copies]);
    setSelection(copies.map((element) => element.id));
    setAnnouncement(`${copies.length === 1 ? elementLabel(copies[0]!) : `${copies.length} elements`} duplicated`);
  };

  const nudge = (dx: number, dy: number) => {
    if (selected.every((element) => element.locked)) return;
    updateSelected((element) => (element.locked ? element : { ...element, x: round(element.x + dx), y: round(element.y + dy) }));
  };

  const align = (alignment: Alignment) => {
    const target = selected.length > 1 && selectionBounds ? selectionBounds : { x: 0, y: 0, width: design.width, height: design.height };
    const moved = new Map(alignElements(selected.filter((element) => !element.locked), alignment, target).map((element) => [element.id, element]));
    commitElements(page.elements.map((element) => moved.get(element.id) ?? element));
  };

  const distribute = (axis: "horizontal" | "vertical") => {
    const moved = new Map(distributeElements(selected.filter((element) => !element.locked), axis).map((element) => [element.id, element]));
    commitElements(page.elements.map((element) => moved.get(element.id) ?? element));
  };

  const arrange = (order: Arrange) => commitElements(arrangeElements(page.elements, selectedSet, order));

  const patchSelected = (patch: Partial<DesignElement>) =>
    updateSelected((element) => {
      const next = { ...element, ...patch };
      return next.kind === "text" && ("fontSize" in patch || "width" in patch || "fontWeight" in patch) ? { ...next, height: textHeight(next) } : next;
    });

  const resizeDesign = (width: number, height: number) => {
    const w = Math.round(Math.min(8000, Math.max(16, width)));
    const h = Math.round(Math.min(8000, Math.max(16, height)));
    if (w === design.width && h === design.height) return;
    const from = { x: 0, y: 0, width: design.width, height: design.height };
    const to = { x: 0, y: 0, width: w, height: h };
    commit({ width: w, height: h, pages: design.pages.map((item) => ({ ...item, elements: scaleElements(item.elements, from, to) })) });
    setZoomSetting(null);
  };

  /* ---------------- pages ---------------- */

  const switchPage = (next: string) => {
    commitText();
    setPageId(next);
    setSelection([]);
  };
  const addPage = () => {
    const created: DesignPage = { id: newId("page"), name: "", background: "#ffffff", elements: [] };
    commit({ ...design, pages: [...design.pages.slice(0, pageIndex + 1), created, ...design.pages.slice(pageIndex + 1)] });
    switchPage(created.id);
  };
  const duplicatePage = (target: string) => {
    const index = design.pages.findIndex((item) => item.id === target);
    const source = design.pages[index];
    if (!source) return;
    const copy: DesignPage = { ...source, id: newId("page"), elements: source.elements.map((element) => ({ ...element, id: newId(element.kind) })) };
    commit({ ...design, pages: [...design.pages.slice(0, index + 1), copy, ...design.pages.slice(index + 1)] });
    switchPage(copy.id);
  };
  const deletePage = (target: string) => {
    if (design.pages.length <= 1) return;
    const index = design.pages.findIndex((item) => item.id === target);
    const pages = design.pages.filter((item) => item.id !== target);
    commit({ ...design, pages });
    if (target === page.id) switchPage(pages[Math.max(0, index - 1)]!.id);
  };

  /* ---------------- images ---------------- */

  const insertImageFile = async (file: File, at?: Point) => {
    try {
      const { src, width, height } = await readImage(file);
      const scale = Math.min(1, (design.width * 0.6) / width, (design.height * 0.6) / height);
      const w = round(width * scale);
      const h = round(height * scale);
      const center = at ?? { x: design.width / 2, y: design.height / 2 };
      const target = replaceTargetRef.current;
      replaceTargetRef.current = null;
      if (target) {
        commitElements(page.elements.map((element) => (element.id === target ? { ...element, src } : element)));
        setAnnouncement("Image replaced");
        return;
      }
      addElement({ id: newId("image"), kind: "image", src, alt: file.name.replace(/\.[^.]+$/, ""), x: round(center.x - w / 2), y: round(center.y - h / 2), width: w, height: h });
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "The image could not be added.");
    }
  };

  /* ---------------- text editing ---------------- */

  const startTextEdit = (element: DesignElement) => {
    if (readOnly || element.locked || element.kind !== "text") return;
    setSelection([element.id]);
    setEditingText({ id: element.id, value: element.text ?? "" });
  };

  const commitText = () => {
    if (!editingText) return;
    const current = page.elements.find((element) => element.id === editingText.id);
    setEditingText(null);
    if (!current) return;
    if (!editingText.value.trim()) {
      commitElements(page.elements.filter((element) => element.id !== current.id));
      setSelection([]);
      return;
    }
    if (editingText.value !== current.text) {
      const next = { ...current, text: editingText.value };
      commitElements(page.elements.map((element) => (element.id === current.id ? { ...next, height: textHeight(next) } : element)));
    }
    viewportRef.current?.focus({ preventScroll: true });
  };

  /* ---------------- pointer ---------------- */

  const handleThreshold = 6 / zoom;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editingText) {
      if ((event.target as HTMLElement).closest("textarea")) return;
      commitText();
    }
    if (event.button === 2) return;
    viewportRef.current?.focus({ preventScroll: true });
    const point = toPage(event.clientX, event.clientY);
    const viewport = viewportRef.current;
    const panning = event.button === 1 || tool === "hand" || spaceDown;
    if (panning && viewport) {
      dragRef.current = { mode: "pan", client: { x: event.clientX, y: event.clientY }, scroll: { x: viewport.scrollLeft, y: viewport.scrollTop } };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (event.button !== 0 || readOnly) return;
    const target = event.target as Element;
    const handle = target.closest("[data-handle]")?.getAttribute("data-handle") as Handle | null;
    const rotate = target.closest("[data-rotate]");
    const lineEnd = target.closest("[data-line-end]")?.getAttribute("data-line-end") as "start" | "end" | null;
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (tool !== "select" && tool !== "hand") {
      dragRef.current = { mode: "create", kind: tool, origin: point };
      return;
    }
    if (lineEnd && selected.length === 1) {
      dragRef.current = { mode: "line-end", end: lineEnd, start: selected[0]! };
      return;
    }
    if (rotate && selected.length === 1) {
      dragRef.current = { mode: "rotate", start: selected[0]! };
      return;
    }
    if (handle && selectionBounds) {
      dragRef.current = { mode: "resize", handle, start: selected, box: selectionBounds, keepAspect: event.shiftKey || selected.some((element) => element.kind === "image" || element.kind === "text") };
      return;
    }
    const hit = elementAt(elements, point, { tolerance: handleThreshold });
    if (hit) {
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const ids = additive ? (selectedSet.has(hit.id) ? selection.filter((item) => item !== hit.id) : [...selection, hit.id]) : selectedSet.has(hit.id) ? selection : [hit.id];
      if (ids.join() !== selection.join()) select(ids);
      const moving = page.elements.filter((element) => ids.includes(element.id) && !element.locked);
      dragRef.current = { mode: "move", origin: point, start: moving, moved: false };
      return;
    }
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (!additive && selection.length) select([]);
    dragRef.current = { mode: "marquee", origin: point, additive, base: additive ? selection : [] };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toPage(event.clientX, event.clientY);
    switch (drag.mode) {
      case "pan": {
        const viewport = viewportRef.current;
        if (viewport) {
          viewport.scrollLeft = drag.scroll.x - (event.clientX - drag.client.x);
          viewport.scrollTop = drag.scroll.y - (event.clientY - drag.client.y);
        }
        return;
      }
      case "move": {
        if (drag.start.length === 0) return;
        let dx = point.x - drag.origin.x;
        let dy = point.y - drag.origin.y;
        if (!drag.moved && Math.hypot(dx, dy) * zoom < 3) return;
        drag.moved = true;
        const startBounds = unionBounds(drag.start.map(elementBounds))!;
        const movingIds = new Set(drag.start.map((element) => element.id));
        const others = page.elements.filter((element) => !movingIds.has(element.id) && !element.hidden).map(elementBounds);
        if (!event.altKey) {
          const snap = snapBox({ ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy }, others, design, handleThreshold);
          dx += snap.dx;
          dy += snap.dy;
          setGuides(snap.guides);
        } else {
          setGuides([]);
        }
        const moved = new Map(drag.start.map((element) => [element.id, { ...element, x: round(element.x + dx), y: round(element.y + dy) }]));
        setPreview(page.elements.map((element) => moved.get(element.id) ?? element));
        return;
      }
      case "resize": {
        let next: DesignElement[];
        if (drag.start.length === 1) {
          const element = drag.start[0]!;
          const size = resizeElement(element, drag.handle, point, { keepAspect: drag.keepAspect || event.shiftKey });
          const resized = { ...element, ...size };
          next = [resized.kind === "text" ? { ...resized, height: Math.max(size.height, textHeight(resized)) } : resized];
        } else {
          const box = drag.box;
          const virtual: DesignElement = { id: "box", kind: "rect", ...box };
          const size = resizeElement(virtual, drag.handle, point, { keepAspect: drag.keepAspect || event.shiftKey });
          next = scaleElements(drag.start, box, { x: size.x, y: size.y, width: size.width, height: size.height });
        }
        const map = new Map(next.map((element) => [element.id, element]));
        setPreview(page.elements.map((element) => map.get(element.id) ?? element));
        return;
      }
      case "rotate": {
        const rotation = rotationFor(boxCenter(drag.start), point, event.shiftKey);
        setPreview(page.elements.map((element) => (element.id === drag.start.id ? { ...element, rotation } : element)));
        return;
      }
      case "line-end": {
        const element = drag.start;
        const startPoint = { x: element.x, y: element.y };
        const endPoint = { x: element.x + element.width, y: element.y + element.height };
        const fixed = drag.end === "start" ? endPoint : startPoint;
        let moving = point;
        if (event.shiftKey) {
          const angle = Math.round(Math.atan2(point.y - fixed.y, point.x - fixed.x) / (Math.PI / 4)) * (Math.PI / 4);
          const length = Math.hypot(point.x - fixed.x, point.y - fixed.y);
          moving = { x: fixed.x + Math.cos(angle) * length, y: fixed.y + Math.sin(angle) * length };
        }
        const from = drag.end === "start" ? moving : fixed;
        const to = drag.end === "start" ? fixed : moving;
        setPreview(page.elements.map((item) => (item.id === element.id ? { ...item, x: round(from.x), y: round(from.y), width: round(to.x - from.x), height: round(to.y - from.y) } : item)));
        return;
      }
      case "create": {
        const linear = drag.kind === "line" || drag.kind === "arrow";
        const defaults = DEFAULTS[drag.kind];
        let x = drag.origin.x;
        let y = drag.origin.y;
        let width = point.x - drag.origin.x;
        let heightValue = point.y - drag.origin.y;
        if (!linear) {
          if (event.shiftKey) {
            const side = Math.max(Math.abs(width), Math.abs(heightValue));
            width = Math.sign(width || 1) * side;
            heightValue = Math.sign(heightValue || 1) * side;
          }
          x = Math.min(x, x + width);
          y = Math.min(y, y + heightValue);
          width = Math.abs(width);
          heightValue = Math.abs(heightValue);
        }
        setDraft({ id: "draft", kind: drag.kind, ...defaults, x: round(x), y: round(y), width: round(width), height: round(heightValue) });
        return;
      }
      case "marquee": {
        const box = { x: Math.min(drag.origin.x, point.x), y: Math.min(drag.origin.y, point.y), width: Math.abs(point.x - drag.origin.x), height: Math.abs(point.y - drag.origin.y) };
        setMarquee(box);
        return;
      }
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setGuides([]);
    if (!drag) return;
    if (drag.mode === "create") {
      const created = draft && (Math.abs(draft.width) > 4 || Math.abs(draft.height) > 4) ? { ...draft, id: newId(draft.kind) } : createAt(drag.kind, drag.origin);
      setDraft(null);
      const element = created.kind === "text" ? { ...created, width: Math.max(created.width, 120), height: textHeight({ ...created, width: Math.max(created.width, 120) }) } : created;
      addElement(element);
      setTool("select");
      if (element.kind === "text") setEditingText({ id: element.id, value: element.text ?? "" });
      return;
    }
    if (drag.mode === "marquee") {
      const box = marquee;
      setMarquee(null);
      if (!box || box.width * zoom < 3) return;
      const hits = page.elements.filter((element) => !element.hidden && !element.locked && boxesIntersect(elementBounds(element), box)).map((element) => element.id);
      select([...new Set([...drag.base, ...hits])]);
      return;
    }
    if (preview) {
      commitElements(preview);
      setPreview(null);
    }
  };

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const up = (event: globalThis.KeyboardEvent) => {
      if (event.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keyup", up);
    return () => window.removeEventListener("keyup", up);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editingText || (event.target as HTMLElement).closest("input, textarea, select")) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key;
    const handled = () => event.preventDefault();
    if (key === " ") {
      handled();
      setSpaceDown(true);
      return;
    }
    if (mod && key.toLowerCase() === "z") {
      handled();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key.toLowerCase() === "y") {
      handled();
      redo();
      return;
    }
    if (mod && (key === "=" || key === "+")) {
      handled();
      zoomTo(zoom * 1.25);
      return;
    }
    if (mod && key === "-") {
      handled();
      zoomTo(zoom / 1.25);
      return;
    }
    if (mod && key === "0") {
      handled();
      setZoomSetting(null);
      return;
    }
    if (readOnly) {
      if (key === "ArrowRight" || key === "PageDown") switchPage(design.pages[Math.min(design.pages.length - 1, pageIndex + 1)]!.id);
      if (key === "ArrowLeft" || key === "PageUp") switchPage(design.pages[Math.max(0, pageIndex - 1)]!.id);
      return;
    }
    if (mod) {
      const lower = key.toLowerCase();
      if (lower === "a") {
        handled();
        select(page.elements.filter((element) => !element.hidden && !element.locked).map((element) => element.id));
      } else if (lower === "d") {
        handled();
        duplicate();
      } else if (lower === "c" || lower === "x") {
        if (selected.length === 0) return;
        handled();
        clipboardRef.current = selected.map((element) => ({ ...element }));
        if (lower === "x") deleteSelected();
        setAnnouncement(`${selected.length === 1 ? elementLabel(selected[0]!) : `${selected.length} elements`} ${lower === "x" ? "cut" : "copied"}`);
      } else if (lower === "v") {
        if (clipboardRef.current.length === 0) return;
        handled();
        duplicate(clipboardRef.current);
      } else if (key === "]" || key === "}") {
        handled();
        arrange(event.shiftKey ? "front" : "forward");
      } else if (key === "[" || key === "{") {
        handled();
        arrange(event.shiftKey ? "back" : "backward");
      }
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      handled();
      deleteSelected();
      return;
    }
    if (key === "Escape") {
      if (tool !== "select") setTool("select");
      else if (selection.length) select([]);
      handled();
      return;
    }
    if (key === "Enter" && selected.length === 1 && selected[0]!.kind === "text") {
      handled();
      startTextEdit(selected[0]!);
      return;
    }
    if (key.startsWith("Arrow") && selected.length) {
      handled();
      const step = event.shiftKey ? 10 : 1;
      nudge(key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0, key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0);
      return;
    }
    const shortcut = TOOLS.find((item) => item.key && item.key.toLowerCase() === key.toLowerCase());
    if (shortcut && !event.altKey) {
      handled();
      setTool(shortcut.tool);
      setAnnouncement(`${shortcut.label} tool`);
      return;
    }
    if (key.toLowerCase() === "i" && !event.altKey) {
      handled();
      fileRef.current?.click();
    }
  };

  /* ---------------- export ---------------- */

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    download(`${title}-${pageIndex + 1}.svg`, new Blob([serializeSvg(svg, design.width, design.height)], { type: "image/svg+xml" }));
  };

  const exportPng = async (scale: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const source = serializeSvg(svg, design.width, design.height);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(design.width * scale);
      canvas.height = Math.round(design.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no blob");
      download(`${title}-${pageIndex + 1}.png`, blob);
      setAnnouncement("PNG exported");
    } catch {
      setAnnouncement("PNG export failed. Images from other sites can block it; export SVG instead.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const exportJson = () => download(`${title}.json`, new Blob([JSON.stringify(design, null, 2)], { type: "application/json" }));

  /* ---------------- render ---------------- */

  const overlayStroke = 1.5 / zoom;
  const handleSize = 9 / zoom;
  const single = selected.length === 1 ? selected[0]! : null;
  const editingElement = editingText ? page.elements.find((element) => element.id === editingText.id) : undefined;
  const renderPage: DesignPage = { ...page, elements: editingText ? elements.filter((element) => element.id !== editingText.id) : elements };

  const handles: Array<{ handle: Handle; point: Point }> = [];
  let rotateHandle: Point | null = null;
  let outline: Point[] | null = null;
  if (!readOnly && !editingText) {
    if (single && !isLinear(single)) {
      const corners = elementCorners(single);
      outline = corners;
      const center = boxCenter(single);
      const local = (x: number, y: number) => rotatePoint({ x, y }, center, single.rotation ?? 0);
      const { x, y, width: w, height: h } = single;
      if (!single.locked) {
        handles.push(
          { handle: "nw", point: local(x, y) },
          { handle: "n", point: local(x + w / 2, y) },
          { handle: "ne", point: local(x + w, y) },
          { handle: "e", point: local(x + w, y + h / 2) },
          { handle: "se", point: local(x + w, y + h) },
          { handle: "s", point: local(x + w / 2, y + h) },
          { handle: "sw", point: local(x, y + h) },
          { handle: "w", point: local(x, y + h / 2) },
        );
        rotateHandle = local(x + w / 2, y - 28 / zoom);
      }
    } else if (selected.length > 1 && selectionBounds) {
      const { x, y, width: w, height: h } = selectionBounds;
      outline = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      if (!selected.some((element) => element.locked)) {
        handles.push({ handle: "nw", point: { x, y } }, { handle: "ne", point: { x: x + w, y } }, { handle: "se", point: { x: x + w, y: y + h } }, { handle: "sw", point: { x, y: y + h } });
      }
    }
  }

  const cursor = spaceDown || tool === "hand" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair";
  const toolButton = cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-accent aria-pressed:text-foreground [&_svg]:size-4",
    focusRing,
  );

  return (
    <div data-slot="design-editor" className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-background text-sm text-foreground", className)} style={{ height }} {...props}>
      {!readOnly ? (
        <Toolbar.Root aria-label="Design tools" className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
          {TOOLS.map((item) => (
            <Toolbar.Button
              key={item.tool}
              aria-label={item.label}
              aria-pressed={tool === item.tool}
              aria-keyshortcuts={item.key || undefined}
              title={item.key ? `${item.label} (${item.key})` : item.label}
              onClick={() => setTool(item.tool)}
              className={toolButton}
            >
              {item.icon}
            </Toolbar.Button>
          ))}
          <Toolbar.Button aria-label="Image" title="Image (I)" aria-keyshortcuts="I" onClick={() => fileRef.current?.click()} className={toolButton}>
            <ImageIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
          <Toolbar.Button aria-label="Undo" disabled={history.past.length === 0} onClick={undo} className={toolButton}>
            <Undo2Icon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label="Redo" disabled={history.future.length === 0} onClick={redo} className={toolButton}>
            <Redo2Icon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
          <Toolbar.Button aria-label="Zoom out" onClick={() => zoomTo(zoom / 1.25)} className={toolButton}>
            <ZoomOutIcon aria-hidden="true" />
          </Toolbar.Button>
          <Toolbar.Button aria-label={`Zoom ${Math.round(zoom * 100)}%, fit to screen`} onClick={() => setZoomSetting(null)} className={cn(toolButton, "w-14 text-xs tabular-nums")}>
            {Math.round(zoom * 100)}%
          </Toolbar.Button>
          <Toolbar.Button aria-label="Zoom in" onClick={() => zoomTo(zoom * 1.25)} className={toolButton}>
            <ZoomInIcon aria-hidden="true" />
          </Toolbar.Button>
          <span className="ml-auto" />
          <ActionMenu
            align="end"
            trigger={
              <Toolbar.Button aria-label="Export" className={toolButton}>
                <DownloadIcon aria-hidden="true" />
              </Toolbar.Button>
            }
            items={[
              { id: "png", label: "PNG", onSelect: () => void exportPng(1) },
              { id: "png2", label: "PNG at 2×", onSelect: () => void exportPng(2) },
              { id: "svg", label: "SVG", onSelect: exportSvg },
              { type: "separator", id: "s" },
              { id: "json", label: "Design file (JSON)", onSelect: exportJson },
            ]}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void insertImageFile(file);
            }}
          />
        </Toolbar.Root>
      ) : (
        <div className="flex items-center gap-2 border-b border-border px-2 py-1">
          <button type="button" aria-label="Previous page" disabled={pageIndex === 0} onClick={() => switchPage(design.pages[pageIndex - 1]!.id)} className={toolButton}>
            <ChevronLeftIcon aria-hidden="true" />
          </button>
          <span aria-live="polite" className="text-xs tabular-nums">
            Page {pageIndex + 1} of {design.pages.length}
          </span>
          <button type="button" aria-label="Next page" disabled={pageIndex >= design.pages.length - 1} onClick={() => switchPage(design.pages[pageIndex + 1]!.id)} className={toolButton}>
            <ChevronRightIcon aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {!readOnly && (
          <aside aria-label="Pages and layers" className="hidden w-48 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-2 md:flex">
            <PagesPanel design={design} pageId={page.id} readOnly={readOnly} onSelect={switchPage} onAdd={addPage} onDuplicate={duplicatePage} onDelete={deletePage} />
            <LayersPanel
              page={page}
              selection={selectedSet}
              readOnly={readOnly}
              onSelect={(elementId, additive) => select(additive ? (selectedSet.has(elementId) ? selection.filter((item) => item !== elementId) : [...selection, elementId]) : [elementId])}
              onToggle={(elementId, key) => {
                commitElements(page.elements.map((element) => (element.id === elementId ? { ...element, [key]: !element[key] } : element)));
                if (key === "hidden") setSelection(selection.filter((item) => item !== elementId));
              }}
            />
          </aside>
        )}
        <div
          ref={viewportRef}
          role="application"
          aria-roledescription="design canvas"
          aria-label={`${label}, page ${pageIndex + 1} of ${design.pages.length}`}
          aria-describedby={`${id}-help`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(event) => {
            const hit = elementAt(page.elements, toPage(event.clientX, event.clientY));
            if (hit?.kind === "text") startTextEdit(hit);
          }}
          onDragOver={(event) => {
            if (!readOnly && event.dataTransfer.types.includes("Files")) event.preventDefault();
          }}
          onDrop={(event) => {
            if (readOnly) return;
            const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
            if (!file) return;
            event.preventDefault();
            void insertImageFile(file, toPage(event.clientX, event.clientY));
          }}
          className={cn("relative min-w-0 flex-1 touch-none overflow-auto bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", cursor)}
        >
          <div className="relative" style={{ width: design.width * zoom + PADDING * 2, height: design.height * zoom + PADDING * 2, minWidth: "100%", minHeight: "100%" }}>
            <div className="absolute shadow-md" style={{ left: PADDING, top: PADDING, width: design.width * zoom, height: design.height * zoom }}>
              <DesignPageSvg ref={svgRef} page={renderPage} width={design.width} height={design.height} className="block size-full" role="img" aria-label={`Page ${pageIndex + 1}: ${page.elements.length} elements`}>
                <g data-overlay="" pointerEvents="none">
                  {guides.map((guide, index) =>
                    guide.axis === "x" ? (
                      <line key={index} x1={guide.position} x2={guide.position} y1={guide.from} y2={guide.to} stroke="#e11d74" strokeWidth={overlayStroke} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
                    ) : (
                      <line key={index} y1={guide.position} y2={guide.position} x1={guide.from} x2={guide.to} stroke="#e11d74" strokeWidth={overlayStroke} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
                    ),
                  )}
                  {draft && (isLinear(draft) ? <line x1={draft.x} y1={draft.y} x2={draft.x + draft.width} y2={draft.y + draft.height} stroke="var(--primary)" strokeWidth={overlayStroke * 2} /> : <rect x={draft.x} y={draft.y} width={draft.width} height={draft.height} fill="none" stroke="var(--primary)" strokeWidth={overlayStroke} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />)}
                  {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} fill="color-mix(in oklab, var(--primary) 12%, transparent)" stroke="var(--primary)" strokeWidth={overlayStroke} />}
                  {selected.length > 1 &&
                    selected.map((element) => {
                      const bounds = elementBounds(element);
                      return <rect key={element.id} x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="none" stroke="var(--primary)" strokeOpacity={0.5} strokeWidth={overlayStroke} />;
                    })}
                  {outline && <polygon points={outline.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={overlayStroke} />}
                  {single && isLinear(single) && !readOnly && <line x1={single.x} y1={single.y} x2={single.x + single.width} y2={single.y + single.height} stroke="var(--primary)" strokeOpacity={0.4} strokeWidth={Math.max(overlayStroke * 4, (single.strokeWidth ?? 2) + overlayStroke * 4)} />}
                </g>
                <g data-overlay="">
                  {handles.map(({ handle, point }) => (
                    <rect key={handle} data-handle={handle} x={point.x - handleSize / 2} y={point.y - handleSize / 2} width={handleSize} height={handleSize} rx={2 / zoom} fill="white" stroke="var(--primary)" strokeWidth={overlayStroke} className="cursor-pointer" />
                  ))}
                  {rotateHandle && <circle data-rotate="" cx={rotateHandle.x} cy={rotateHandle.y} r={handleSize / 1.6} fill="white" stroke="var(--primary)" strokeWidth={overlayStroke} className="cursor-grab" />}
                  {single &&
                    isLinear(single) &&
                    !readOnly &&
                    !single.locked &&
                    (["start", "end"] as const).map((end) => (
                      <circle key={end} data-line-end={end} cx={end === "start" ? single.x : single.x + single.width} cy={end === "start" ? single.y : single.y + single.height} r={handleSize / 1.6} fill="white" stroke="var(--primary)" strokeWidth={overlayStroke} className="cursor-pointer" />
                    ))}
                </g>
              </DesignPageSvg>
              {editingText && editingElement && (
                <textarea
                  autoFocus
                  aria-label="Edit text"
                  value={editingText.value}
                  onChange={(event) => setEditingText({ ...editingText, value: event.target.value })}
                  onBlur={commitText}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
                      event.preventDefault();
                      commitText();
                    }
                  }}
                  className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-2 outline-primary"
                  style={{
                    left: editingElement.x * zoom,
                    top: editingElement.y * zoom,
                    width: editingElement.width * zoom,
                    height: Math.max(textHeight({ ...editingElement, text: editingText.value }), editingElement.height) * zoom,
                    fontSize: (editingElement.fontSize ?? 24) * zoom,
                    fontWeight: editingElement.fontWeight ?? 400,
                    fontFamily: editingElement.fontFamily ?? "system-ui, sans-serif",
                    lineHeight: editingElement.lineHeight ?? 1.25,
                    color: editingElement.color ?? "#111111",
                    textAlign: editingElement.textAlign ?? "left",
                    transform: editingElement.rotation ? `rotate(${editingElement.rotation}deg)` : undefined,
                  }}
                />
              )}
            </div>
          </div>
        </div>
        {!readOnly && (
          <aside aria-label="Properties" className="hidden w-60 shrink-0 overflow-y-auto border-l border-border p-3 lg:block">
            <PropertiesPanel
              design={design}
              page={page}
              selected={selected}
              onChange={patchSelected}
              onPageChange={(patch) => commit({ ...design, pages: design.pages.map((item, index) => (index === pageIndex ? { ...item, ...patch } : item)) })}
              onResizeDesign={resizeDesign}
              onAlign={align}
              onDistribute={distribute}
              onArrange={arrange}
              onDuplicate={() => duplicate()}
              onDelete={deleteSelected}
              onReplaceImage={() => {
                replaceTargetRef.current = single?.id ?? null;
                fileRef.current?.click();
              }}
            />
          </aside>
        )}
      </div>
      <p id={`${id}-help`} className="sr-only">
        {readOnly
          ? "Use the left and right arrow keys to change pages."
          : "Press V to select, R for rectangle, O for ellipse, L for line, A for arrow, T for text and I for an image. Arrow keys move the selection, Shift for larger steps. Delete removes it. Control plus D duplicates, Control plus Z undoes. Use the layers list to select elements without a pointer."}
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
