// packages/ai-ui/src/components/whiteboard.tsx
"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import {
  CircleIcon,
  HandIcon,
  MinusIcon,
  MousePointer2Icon,
  MoveUpRightIcon,
  PlusIcon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import {
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type WhiteboardShapeType = "rectangle" | "ellipse" | "text";

export interface WhiteboardShape {
  id: string;
  type: WhiteboardShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string | undefined;
}

export interface WhiteboardConnector {
  id: string;
  type: "connector";
  from: string;
  to: string;
}

export type WhiteboardElement = WhiteboardShape | WhiteboardConnector;
export type WhiteboardTool = "select" | "hand" | WhiteboardShapeType | "connector";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

type Drag =
  | { mode: "pan"; startX: number; startY: number; origin: Viewport }
  | { mode: "move"; startX: number; startY: number; id: string; originX: number; originY: number }
  | { mode: "resize"; startX: number; startY: number; id: string; originWidth: number; originHeight: number }
  | { mode: "create"; type: WhiteboardShapeType; x: number; y: number }
  | { mode: "connect"; from: string };

type Draft =
  | { kind: "shape"; type: WhiteboardShapeType; x0: number; y0: number; x1: number; y1: number }
  | { kind: "connector"; from: string; x: number; y: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const MIN_SIZE = 24;
const DEFAULT_SIZE: Record<WhiteboardShapeType, { width: number; height: number }> = {
  rectangle: { width: 160, height: 80 },
  ellipse: { width: 140, height: 90 },
  text: { width: 180, height: 40 },
};

const TOOLS: Array<{ tool: WhiteboardTool; label: string; shortcut: string; icon: ReactNode }> = [
  { tool: "select", label: "Select", shortcut: "V", icon: <MousePointer2Icon aria-hidden="true" /> },
  { tool: "hand", label: "Pan", shortcut: "H", icon: <HandIcon aria-hidden="true" /> },
  { tool: "rectangle", label: "Rectangle", shortcut: "R", icon: <SquareIcon aria-hidden="true" /> },
  { tool: "ellipse", label: "Ellipse", shortcut: "O", icon: <CircleIcon aria-hidden="true" /> },
  { tool: "text", label: "Text", shortcut: "T", icon: <TypeIcon aria-hidden="true" /> },
  { tool: "connector", label: "Connector", shortcut: "C", icon: <MoveUpRightIcon aria-hidden="true" /> },
];

let idCounter = 0;
function createId(): string {
  idCounter += 1;
  return `wb-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function isShape(element: WhiteboardElement): element is WhiteboardShape {
  return element.type !== "connector";
}

function boundaryPoint(shape: WhiteboardShape, towardX: number, towardY: number): [number, number] {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const rx = shape.width / 2;
  const ry = shape.height / 2;
  const t =
    shape.type === "ellipse"
      ? 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
      : Math.min(dx === 0 ? Infinity : rx / Math.abs(dx), dy === 0 ? Infinity : ry / Math.abs(dy));
  return [cx + dx * t, cy + dy * t];
}

function describe(shape: WhiteboardShape): string {
  const name = shape.type === "text" ? "Text" : shape.type === "ellipse" ? "Ellipse" : "Rectangle";
  return shape.text ? `${name}: ${shape.text}` : name;
}

export interface WhiteboardProps extends Omit<ComponentProps<"div">, "children"> {
  elements?: WhiteboardElement[];
  defaultElements?: WhiteboardElement[];
  onElementsChange?: (elements: WhiteboardElement[]) => void;
  readOnly?: boolean;
}

/**
 * Lightweight infinite canvas with rectangles, ellipses, text and connectors.
 * Drag empty space or hold Space to pan, Ctrl or Cmd + wheel to zoom. Keys:
 * V H R O T C pick tools, arrows nudge, Alt + arrows resize, Enter edits
 * text, Delete removes. With the connector tool, drag between shapes or
 * click (or press Enter on) the source and then the target.
 */
export function Whiteboard({
  elements: elementsProp,
  defaultElements = [],
  onElementsChange,
  readOnly = false,
  className,
  onKeyDown,
  ...props
}: WhiteboardProps) {
  const [elements, setElements] = useControllableState({
    value: elementsProp,
    defaultValue: defaultElements,
    onChange: onElementsChange,
  });
  const [tool, setTool] = useState<WhiteboardTool>("select");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const editFinished = useRef(true);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const shapes = elements.filter(isShape);
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
  const selected = selectedId ? shapeById.get(selectedId) : undefined;
  const pendingSource = connectFrom ? shapeById.get(connectFrom) : undefined;

  const selectTool = (next: WhiteboardTool) => {
    setTool(next);
    setConnectFrom(null);
  };

  /** Adds a connector unless it would loop or duplicate one, and ends any pending connection. */
  const connect = (from: string, to: string) => {
    setConnectFrom(null);
    const exists = elements.some((element) => element.type === "connector" && element.from === from && element.to === to);
    if (from === to || exists || !shapeById.has(from) || !shapeById.has(to)) return;
    setElements([...elements, { id: createId(), type: "connector", from, to }]);
  };

  /** Click or Enter on a shape with the connector tool: picks the source, then connects to the target. */
  const pickConnectorEnd = (id: string) => {
    if (connectFrom && connectFrom !== id) connect(connectFrom, id);
    else setConnectFrom(connectFrom === id ? null : id);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setViewport((current) => {
        if (!event.ctrlKey && !event.metaKey) {
          return { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY };
        }
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * Math.exp(-event.deltaY * 0.01)));
        const ratio = zoom / current.zoom;
        return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const toWorld = (clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current?.getBoundingClientRect();
    return [
      (clientX - (rect?.left ?? 0) - viewport.x) / viewport.zoom,
      (clientY - (rect?.top ?? 0) - viewport.y) / viewport.zoom,
    ];
  };

  const updateShape = (id: string, patch: Partial<WhiteboardShape>) =>
    setElements(elements.map((element) => (element.id === id && isShape(element) ? { ...element, ...patch } : element)));

  const removeElement = (id: string) => {
    setElements(
      elements.filter(
        (element) => element.id !== id && !(element.type === "connector" && (element.from === id || element.to === id)),
      ),
    );
    setSelectedId(null);
  };

  const zoomBy = (factor: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const px = (rect?.width ?? 0) / 2;
    const py = (rect?.height ?? 0) / 2;
    setViewport((current) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor));
      const ratio = zoom / current.zoom;
      return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  };

  const startEditing = (shape: WhiteboardShape) => {
    editFinished.current = false;
    setEditing({ id: shape.id, text: shape.text ?? "" });
  };

  /** Ends the text edit once: saves unless cancelled, then returns focus to the shape. */
  const finishEditing = (save: boolean) => {
    if (!editing || editFinished.current) return;
    editFinished.current = true;
    if (save) updateShape(editing.id, { text: editing.text });
    setEditing(null);
    svgRef.current?.querySelector<SVGGElement>(`[data-shape-id="${editing.id}"]`)?.focus();
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    finishEditing(true);
    const target = event.target as Element;
    const shapeId = target.closest("[data-shape-id]")?.getAttribute("data-shape-id") ?? null;
    const connectorId = target.closest("[data-connector-id]")?.getAttribute("data-connector-id") ?? null;
    const onHandle = target.closest("[data-resize-handle]") !== null;
    const [wx, wy] = toWorld(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });

    if (event.button === 1 || tool === "hand" || spaceHeld) {
      drag.current = { mode: "pan", startX: event.clientX, startY: event.clientY, origin: viewport };
      return;
    }
    if (readOnly) {
      drag.current = { mode: "pan", startX: event.clientX, startY: event.clientY, origin: viewport };
      return;
    }
    if (tool === "select") {
      if (onHandle && selected) {
        drag.current = {
          mode: "resize",
          startX: event.clientX,
          startY: event.clientY,
          id: selected.id,
          originWidth: selected.width,
          originHeight: selected.height,
        };
      } else if (shapeId) {
        const shape = shapeById.get(shapeId)!;
        setSelectedId(shapeId);
        drag.current = { mode: "move", startX: event.clientX, startY: event.clientY, id: shapeId, originX: shape.x, originY: shape.y };
      } else if (connectorId) {
        setSelectedId(connectorId);
      } else {
        setSelectedId(null);
        drag.current = { mode: "pan", startX: event.clientX, startY: event.clientY, origin: viewport };
      }
      return;
    }
    if (tool === "connector") {
      if (!shapeId) {
        setConnectFrom(null);
        return;
      }
      drag.current = { mode: "connect", from: shapeId };
      setDraft({ kind: "connector", from: shapeId, x: wx, y: wy });
      return;
    }
    drag.current = { mode: "create", type: tool, x: wx, y: wy };
    setDraft({ kind: "shape", type: tool, x0: wx, y0: wy, x1: wx, y1: wy });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current) return;
    if (current.mode === "pan") {
      setViewport({
        ...current.origin,
        x: current.origin.x + event.clientX - current.startX,
        y: current.origin.y + event.clientY - current.startY,
      });
      return;
    }
    const [wx, wy] = toWorld(event.clientX, event.clientY);
    if (current.mode === "move") {
      updateShape(current.id, {
        x: Math.round(current.originX + (event.clientX - current.startX) / viewport.zoom),
        y: Math.round(current.originY + (event.clientY - current.startY) / viewport.zoom),
      });
    } else if (current.mode === "resize") {
      updateShape(current.id, {
        width: Math.max(MIN_SIZE, Math.round(current.originWidth + (event.clientX - current.startX) / viewport.zoom)),
        height: Math.max(MIN_SIZE, Math.round(current.originHeight + (event.clientY - current.startY) / viewport.zoom)),
      });
    } else if (current.mode === "create") {
      setDraft({ kind: "shape", type: current.type, x0: current.x, y0: current.y, x1: wx, y1: wy });
    } else {
      setDraft({ kind: "connector", from: current.from, x: wx, y: wy });
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    drag.current = null;
    setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current) return;
    if (current.mode === "create") {
      const [wx, wy] = toWorld(event.clientX, event.clientY);
      const dragged = Math.abs(wx - current.x) * viewport.zoom > 4 || Math.abs(wy - current.y) * viewport.zoom > 4;
      const size = DEFAULT_SIZE[current.type];
      const shape: WhiteboardShape = dragged
        ? {
            id: createId(),
            type: current.type,
            x: Math.round(Math.min(current.x, wx)),
            y: Math.round(Math.min(current.y, wy)),
            width: Math.max(MIN_SIZE, Math.round(Math.abs(wx - current.x))),
            height: Math.max(MIN_SIZE, Math.round(Math.abs(wy - current.y))),
          }
        : {
            id: createId(),
            type: current.type,
            x: Math.round(current.x - size.width / 2),
            y: Math.round(current.y - size.height / 2),
            ...size,
          };
      setElements([...elements, shape]);
      setSelectedId(shape.id);
      selectTool("select");
      if (shape.type === "text") startEditing(shape);
    } else if (current.mode === "connect") {
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-shape-id]");
      const to = hit?.getAttribute("data-shape-id");
      if (to === current.from) pickConnectorEnd(to);
      else if (to) connect(current.from, to);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || editing || !svgRef.current?.contains(event.target as Node)) return;
    if (event.key === " ") {
      setSpaceHeld(true);
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      selectTool("select");
      setSelectedId(null);
      drag.current = null;
      setDraft(null);
      return;
    }
    if (event.key === "+" || event.key === "=") return zoomBy(1.2);
    if (event.key === "-") return zoomBy(1 / 1.2);
    if (event.key === "0") return setViewport({ x: 0, y: 0, zoom: 1 });
    const step = event.shiftKey ? 1 : 10;
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const delta = arrows[event.key];
    if (!readOnly && event.altKey && delta && selected && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      updateShape(selected.id, {
        width: Math.max(MIN_SIZE, selected.width + delta[0]),
        height: Math.max(MIN_SIZE, selected.height + delta[1]),
      });
      return;
    }
    if (readOnly || event.metaKey || event.ctrlKey || event.altKey) return;
    const shortcut = TOOLS.find((entry) => entry.shortcut.toLowerCase() === event.key.toLowerCase());
    if (shortcut) {
      selectTool(shortcut.tool);
      return;
    }
    if (!selectedId) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeElement(selectedId);
      svgRef.current?.focus();
      return;
    }
    if (!selected) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (tool === "connector") pickConnectorEnd(selected.id);
      else startEditing(selected);
      return;
    }
    if (delta) {
      event.preventDefault();
      updateShape(selected.id, { x: selected.x + delta[0], y: selected.y + delta[1] });
    }
  };

  const editingShape = editing ? shapeById.get(editing.id) : undefined;
  const panning = tool === "hand" || spaceHeld;

  return (
    <div
      data-slot="whiteboard"
      className={cn("relative h-full min-h-80 overflow-hidden rounded-lg border border-border bg-background", className)}
      onKeyDown={handleKeyDown}
      onKeyUp={(event) => {
        if (event.key === " ") setSpaceHeld(false);
      }}
      {...props}
    >
      <Toolbar.Root
        aria-label="Whiteboard tools"
        className="absolute top-2 left-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-sm"
      >
        {TOOLS.filter((entry) => !readOnly || entry.tool === "select" || entry.tool === "hand").map((entry) => (
          <Toolbar.Button
            key={entry.tool}
            aria-label={`${entry.label} (${entry.shortcut})`}
            title={`${entry.label} (${entry.shortcut})`}
            aria-pressed={tool === entry.tool}
            onClick={() => selectTool(entry.tool)}
            className={cn(iconButton, "aria-pressed:bg-accent aria-pressed:text-accent-foreground", focusRing)}
          >
            {entry.icon}
          </Toolbar.Button>
        ))}
        <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
        <Toolbar.Button aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.2)} className={cn(iconButton, focusRing)}>
          <MinusIcon aria-hidden="true" />
        </Toolbar.Button>
        <Toolbar.Button
          aria-label={`${Math.round(viewport.zoom * 100)}% zoom, reset`}
          title="Reset zoom"
          onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
          className={cn("h-8 min-w-12 rounded-md px-1 text-xs text-muted-foreground tabular-nums hover:bg-accent", focusRing)}
        >
          {Math.round(viewport.zoom * 100)}%
        </Toolbar.Button>
        <Toolbar.Button aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.2)} className={cn(iconButton, focusRing)}>
          <PlusIcon aria-hidden="true" />
        </Toolbar.Button>
        {!readOnly && (
          <>
            <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
            <Toolbar.Button
              aria-label="Delete selection"
              title="Delete selection"
              disabled={!selectedId}
              onClick={() => selectedId && removeElement(selectedId)}
              className={cn(iconButton, focusRing)}
            >
              <Trash2Icon aria-hidden="true" />
            </Toolbar.Button>
          </>
        )}
      </Toolbar.Root>

      <svg
        ref={svgRef}
        role="application"
        aria-roledescription="whiteboard"
        aria-label={`Whiteboard with ${shapes.length} ${shapes.length === 1 ? "shape" : "shapes"}`}
        tabIndex={0}
        className={cn(
          "block h-full w-full touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          panning ? "cursor-grab active:cursor-grabbing" : tool === "select" ? "cursor-default" : "cursor-crosshair",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          if (readOnly) return;
          const id = (event.target as Element).closest("[data-shape-id]")?.getAttribute("data-shape-id");
          const shape = id ? shapeById.get(id) : undefined;
          if (shape) startEditing(shape);
        }}
      >
        <defs>
          <pattern
            id={`${uid}-grid`}
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}
          >
            <circle cx={1} cy={1} r={1} fill="var(--border)" />
          </pattern>
          <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={8} markerHeight={8} orient="auto-start-reverse">
            <path d="M0,0L10,5L0,10z" fill="var(--muted-foreground)" />
          </marker>
          <marker id={`${uid}-arrow-active`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={8} markerHeight={8} orient="auto-start-reverse">
            <path d="M0,0L10,5L0,10z" fill="var(--ring)" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${uid}-grid)`} />
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {elements.map((element) => {
            if (element.type !== "connector") return null;
            const from = shapeById.get(element.from);
            const to = shapeById.get(element.to);
            if (!from || !to) return null;
            const [x1, y1] = boundaryPoint(from, to.x + to.width / 2, to.y + to.height / 2);
            const [x2, y2] = boundaryPoint(to, from.x + from.width / 2, from.y + from.height / 2);
            const active = selectedId === element.id;
            return (
              <g key={element.id} data-connector-id={element.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={active ? "var(--ring)" : "var(--muted-foreground)"}
                  strokeWidth={active ? 2 : 1.5}
                  markerEnd={`url(#${uid}-${active ? "arrow-active" : "arrow"})`}
                />
              </g>
            );
          })}
          {shapes.map((shape) => {
            const active = selectedId === shape.id;
            const source = connectFrom === shape.id;
            const stroke = active || source ? "var(--ring)" : "var(--border)";
            const dash = source ? "6 4" : undefined;
            return (
              <g
                key={shape.id}
                data-shape-id={shape.id}
                role="button"
                aria-label={describe(shape)}
                aria-pressed={active}
                tabIndex={0}
                onFocus={() => setSelectedId(shape.id)}
                className={cn("outline-none", tool === "select" && !panning && "cursor-move")}
              >
                {shape.type === "rectangle" && (
                  <rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    rx={8}
                    fill="var(--card)"
                    stroke={stroke}
                    strokeDasharray={dash}
                    strokeWidth={active ? 2 : 1.5}
                  />
                )}
                {shape.type === "ellipse" && (
                  <ellipse
                    cx={shape.x + shape.width / 2}
                    cy={shape.y + shape.height / 2}
                    rx={shape.width / 2}
                    ry={shape.height / 2}
                    fill="var(--card)"
                    stroke={stroke}
                    strokeDasharray={dash}
                    strokeWidth={active ? 2 : 1.5}
                  />
                )}
                {shape.type === "text" && (
                  <rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    rx={4}
                    fill="transparent"
                    stroke={active || source ? "var(--ring)" : "transparent"}
                    strokeDasharray={dash ?? (active ? "4 3" : undefined)}
                  />
                )}
                {editing?.id !== shape.id && (
                  <foreignObject x={shape.x} y={shape.y} width={shape.width} height={shape.height} className="pointer-events-none">
                    <div
                      className={cn(
                        "flex h-full w-full items-center justify-center overflow-hidden p-2 text-center text-sm leading-snug break-words text-foreground",
                        shape.type === "text" && "justify-start text-left text-base",
                      )}
                    >
                      {shape.text}
                    </div>
                  </foreignObject>
                )}
                {active && !readOnly && (
                  <rect
                    data-resize-handle=""
                    x={shape.x + shape.width - 5}
                    y={shape.y + shape.height - 5}
                    width={10}
                    height={10}
                    rx={2}
                    fill="var(--background)"
                    stroke="var(--ring)"
                    strokeWidth={1.5}
                    className="cursor-nwse-resize"
                  />
                )}
              </g>
            );
          })}
          {draft?.kind === "shape" && (
            <rect
              x={Math.min(draft.x0, draft.x1)}
              y={Math.min(draft.y0, draft.y1)}
              width={Math.abs(draft.x1 - draft.x0)}
              height={Math.abs(draft.y1 - draft.y0)}
              rx={draft.type === "ellipse" ? Math.abs(draft.x1 - draft.x0) / 2 : 8}
              fill="color-mix(in oklab, var(--ring) 10%, transparent)"
              stroke="var(--ring)"
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}
          {draft?.kind === "connector" &&
            (() => {
              const from = shapeById.get(draft.from);
              if (!from) return null;
              const [x1, y1] = boundaryPoint(from, draft.x, draft.y);
              return (
                <line
                  x1={x1}
                  y1={y1}
                  x2={draft.x}
                  y2={draft.y}
                  stroke="var(--ring)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  markerEnd={`url(#${uid}-arrow-active)`}
                  pointerEvents="none"
                />
              );
            })()}
        </g>
      </svg>

      <p role="status" className="sr-only">
        {pendingSource
          ? `Connecting from ${describe(pendingSource)}. Choose the target shape and press Enter, or press Escape to cancel.`
          : ""}
      </p>
      {editing && editingShape && (
        <textarea
          autoFocus
          aria-label={`Edit ${describe(editingShape)}`}
          value={editing.text}
          onChange={(event) => setEditing({ ...editing, text: event.target.value })}
          onBlur={() => finishEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              finishEditing(false);
            } else if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              finishEditing(true);
            }
          }}
          className="absolute z-20 resize-none rounded-md border border-ring bg-background p-2 text-center leading-snug text-foreground outline-none"
          style={{
            left: viewport.x + editingShape.x * viewport.zoom,
            top: viewport.y + editingShape.y * viewport.zoom,
            width: editingShape.width * viewport.zoom,
            height: editingShape.height * viewport.zoom,
            fontSize: `${(editingShape.type === "text" ? 16 : 14) * viewport.zoom}px`,
            textAlign: editingShape.type === "text" ? "left" : "center",
          }}
        />
      )}
    </div>
  );
}
