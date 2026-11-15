// packages/ai-ui/src/lib/design/geometry.ts
export type DesignElementKind = "rect" | "ellipse" | "triangle" | "diamond" | "star" | "line" | "arrow" | "text" | "image";

export interface DesignElement {
  id: string;
  kind: DesignElementKind;
  name?: string;
  /** Top-left of the unrotated box, in page units. Lines run from (x, y) to (x + width, y + height). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise around the box center. */
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  /** Corner radius for rectangles. */
  radius?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  color?: string;
  lineHeight?: number;
  src?: string;
  alt?: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface DesignPage {
  id: string;
  name: string;
  background: string;
  elements: DesignElement[];
}

export interface Design {
  width: number;
  height: number;
  pages: DesignPage[];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const isLinear = (element: Pick<DesignElement, "kind">) => element.kind === "line" || element.kind === "arrow";

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  if (!degrees) return point;
  const angle = toRadians(degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export function boxCenter(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Corners of an element after rotation, clockwise from top-left. */
export function elementCorners(element: DesignElement): Point[] {
  if (isLinear(element)) return [{ x: element.x, y: element.y }, { x: element.x + element.width, y: element.y + element.height }];
  const center = boxCenter(element);
  return [
    { x: element.x, y: element.y },
    { x: element.x + element.width, y: element.y },
    { x: element.x + element.width, y: element.y + element.height },
    { x: element.x, y: element.y + element.height },
  ].map((corner) => rotatePoint(corner, center, element.rotation ?? 0));
}

/** Axis-aligned bounds of an element, including rotation. */
export function elementBounds(element: DesignElement): Box {
  const corners = elementCorners(element);
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function unionBounds(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Whether a page point hits an element; lines use a tolerance band. */
export function hitTest(element: DesignElement, point: Point, tolerance = 4): boolean {
  if (isLinear(element)) {
    return distanceToSegment(point, { x: element.x, y: element.y }, { x: element.x + element.width, y: element.y + element.height }) <= Math.max(tolerance, (element.strokeWidth ?? 2) / 2 + 2);
  }
  const local = rotatePoint(point, boxCenter(element), -(element.rotation ?? 0));
  return local.x >= element.x - tolerance && local.x <= element.x + element.width + tolerance && local.y >= element.y - tolerance && local.y <= element.y + element.height + tolerance;
}

/** Topmost visible element under a point, skipping locked ones unless asked. */
export function elementAt(elements: DesignElement[], point: Point, { includeLocked = false, tolerance = 4 } = {}): DesignElement | undefined {
  for (let index = elements.length - 1; index >= 0; index--) {
    const element = elements[index]!;
    if (element.hidden || (element.locked && !includeLocked)) continue;
    if (hitTest(element, point, tolerance)) return element;
  }
  return undefined;
}

/** SVG points for polygon shapes inside a box. */
export function polygonPoints(element: Pick<DesignElement, "kind" | "x" | "y" | "width" | "height">): string {
  const { x, y, width, height } = element;
  const points: Point[] = [];
  if (element.kind === "triangle") points.push({ x: x + width / 2, y }, { x: x + width, y: y + height }, { x, y: y + height });
  else if (element.kind === "diamond") points.push({ x: x + width / 2, y }, { x: x + width, y: y + height / 2 }, { x: x + width / 2, y: y + height }, { x, y: y + height / 2 });
  else if (element.kind === "star") {
    const center = { x: x + width / 2, y: y + height / 2 };
    for (let index = 0; index < 10; index++) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const scale = index % 2 === 0 ? 1 : 0.42;
      points.push({ x: center.x + Math.cos(angle) * (width / 2) * scale, y: center.y + Math.sin(angle) * (height / 2) * scale });
    }
  }
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
}

export const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

/* ------------------------------------------------------------------ */
/* Snapping                                                            */
/* ------------------------------------------------------------------ */

export interface Guide {
  axis: "x" | "y";
  /** Page coordinate of the guide line. */
  position: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

function anchors(box: Box) {
  return { x: [box.x, box.x + box.width / 2, box.x + box.width], y: [box.y, box.y + box.height / 2, box.y + box.height] };
}

/**
 * Snaps a moving box to the page edges and center and to other boxes'
 * edges and centers within `threshold`, returning the correction and guide
 * lines to draw. Only the nearest target per axis is used.
 */
export function snapBox(moving: Box, others: Box[], page: { width: number; height: number }, threshold: number): SnapResult {
  const targets = [{ x: 0, y: 0, width: page.width, height: page.height }, ...others.slice(0, 200)];
  const source = anchors(moving);
  let bestX: { delta: number; position: number; target: Box } | null = null;
  let bestY: { delta: number; position: number; target: Box } | null = null;
  for (const target of targets) {
    const lines = anchors(target);
    for (const from of source.x) {
      for (const to of lines.x) {
        const delta = to - from;
        if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, position: to, target };
      }
    }
    for (const from of source.y) {
      for (const to of lines.y) {
        const delta = to - from;
        if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, position: to, target };
      }
    }
  }
  const guides: Guide[] = [];
  const snapped = { ...moving, x: moving.x + (bestX?.delta ?? 0), y: moving.y + (bestY?.delta ?? 0) };
  if (bestX) guides.push({ axis: "x", position: bestX.position, from: Math.min(snapped.y, bestX.target.y), to: Math.max(snapped.y + snapped.height, bestX.target.y + bestX.target.height) });
  if (bestY) guides.push({ axis: "y", position: bestY.position, from: Math.min(snapped.x, bestY.target.x), to: Math.max(snapped.x + snapped.width, bestY.target.x + bestY.target.width) });
  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guides };
}

/* ------------------------------------------------------------------ */
/* Transforms                                                          */
/* ------------------------------------------------------------------ */

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/**
 * Resizes a (possibly rotated) element by dragging one handle to a page
 * point. The opposite edge or corner stays fixed; `keepAspect` keeps the
 * starting ratio.
 */
export function resizeElement(element: DesignElement, handle: Handle, pointer: Point, { keepAspect = false, minSize = 4 } = {}): Pick<DesignElement, "x" | "y" | "width" | "height"> {
  const rotation = element.rotation ?? 0;
  const center = boxCenter(element);
  const local = rotatePoint(pointer, center, -rotation);
  let left = element.x;
  let top = element.y;
  let right = element.x + element.width;
  let bottom = element.y + element.height;
  if (handle.includes("w")) left = Math.min(local.x, right - minSize);
  if (handle.includes("e")) right = Math.max(local.x, left + minSize);
  if (handle.includes("n")) top = Math.min(local.y, bottom - minSize);
  if (handle.includes("s")) bottom = Math.max(local.y, top + minSize);
  let width = right - left;
  let height = bottom - top;
  if (keepAspect && element.width > 0 && element.height > 0) {
    const ratio = element.width / element.height;
    if (handle === "n" || handle === "s") width = height * ratio;
    else if (handle === "e" || handle === "w") height = width / ratio;
    else if (width / height > ratio) height = width / ratio;
    else width = height * ratio;
    if (handle.includes("w")) left = right - width;
    if (handle.includes("n")) top = bottom - height;
    if (handle === "n" || handle === "s") left = element.x + (element.width - width) / 2;
    if (handle === "e" || handle === "w") top = element.y + (element.height - height) / 2;
  }
  // Keep the fixed side in place on the page when the element is rotated.
  const anchorLocal = { x: handle.includes("w") ? right : handle.includes("e") ? left : left + width / 2, y: handle.includes("n") ? bottom : handle.includes("s") ? top : top + height / 2 };
  const originalAnchorLocal = {
    x: handle.includes("w") ? element.x + element.width : handle.includes("e") ? element.x : element.x + element.width / 2,
    y: handle.includes("n") ? element.y + element.height : handle.includes("s") ? element.y : element.y + element.height / 2,
  };
  const anchorPage = rotatePoint(originalAnchorLocal, center, rotation);
  const newCenterLocal = { x: left + width / 2, y: top + height / 2 };
  const anchorFromNewCenter = rotatePoint(anchorLocal, newCenterLocal, rotation);
  const shiftX = anchorPage.x - anchorFromNewCenter.x;
  const shiftY = anchorPage.y - anchorFromNewCenter.y;
  return { x: round(left + shiftX), y: round(top + shiftY), width: round(width), height: round(height) };
}

/** Rotation in degrees for a pointer around a center; `snap` rounds to 15° steps. */
export function rotationFor(center: Point, pointer: Point, snap = false): number {
  const degrees = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90;
  const normalized = ((degrees % 360) + 360) % 360;
  return snap ? (Math.round(normalized / 15) * 15) % 360 : round(normalized, 1);
}

/** Scales elements from one bounding box to another, as a group resize does. */
export function scaleElements(elements: DesignElement[], from: Box, to: Box): DesignElement[] {
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;
  return elements.map((element) => ({
    ...element,
    x: round(to.x + (element.x - from.x) * sx),
    y: round(to.y + (element.y - from.y) * sy),
    width: round(element.width * sx),
    height: round(element.height * sy),
    ...(element.fontSize ? { fontSize: round(element.fontSize * Math.min(Math.abs(sx), Math.abs(sy)), 1) } : {}),
  }));
}

export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

/** Aligns elements to the edge or center of `target` (the selection or the page). */
export function alignElements(elements: DesignElement[], alignment: Alignment, target: Box): DesignElement[] {
  return elements.map((element) => {
    const bounds = elementBounds(element);
    let dx = 0;
    let dy = 0;
    if (alignment === "left") dx = target.x - bounds.x;
    if (alignment === "center") dx = target.x + target.width / 2 - (bounds.x + bounds.width / 2);
    if (alignment === "right") dx = target.x + target.width - (bounds.x + bounds.width);
    if (alignment === "top") dy = target.y - bounds.y;
    if (alignment === "middle") dy = target.y + target.height / 2 - (bounds.y + bounds.height / 2);
    if (alignment === "bottom") dy = target.y + target.height - (bounds.y + bounds.height);
    return { ...element, x: round(element.x + dx), y: round(element.y + dy) };
  });
}

/** Spaces three or more elements with equal gaps along an axis, keeping the outer two in place. */
export function distributeElements(elements: DesignElement[], axis: "horizontal" | "vertical"): DesignElement[] {
  if (elements.length < 3) return elements;
  const horizontal = axis === "horizontal";
  const sorted = elements.map((element) => ({ element, bounds: elementBounds(element) })).sort((a, b) => (horizontal ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y));
  const first = sorted[0]!.bounds;
  const last = sorted.at(-1)!.bounds;
  const span = horizontal ? last.x + last.width - first.x : last.y + last.height - first.y;
  const total = sorted.reduce((sum, item) => sum + (horizontal ? item.bounds.width : item.bounds.height), 0);
  const gap = (span - total) / (sorted.length - 1);
  let cursor = horizontal ? first.x : first.y;
  const moved = new Map<string, DesignElement>();
  for (const { element, bounds } of sorted) {
    const delta = cursor - (horizontal ? bounds.x : bounds.y);
    moved.set(element.id, horizontal ? { ...element, x: round(element.x + delta) } : { ...element, y: round(element.y + delta) });
    cursor += (horizontal ? bounds.width : bounds.height) + gap;
  }
  return elements.map((element) => moved.get(element.id) ?? element);
}

export type Arrange = "forward" | "front" | "backward" | "back";

/** Reorders selected elements in the stack, keeping their relative order. */
export function arrangeElements(elements: DesignElement[], ids: ReadonlySet<string>, arrange: Arrange): DesignElement[] {
  const selected = elements.filter((element) => ids.has(element.id));
  const rest = elements.filter((element) => !ids.has(element.id));
  if (arrange === "front") return [...rest, ...selected];
  if (arrange === "back") return [...selected, ...rest];
  const next = [...elements];
  if (arrange === "forward") {
    for (let index = next.length - 2; index >= 0; index--) {
      if (ids.has(next[index]!.id) && !ids.has(next[index + 1]!.id)) [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
    }
  } else {
    for (let index = 1; index < next.length; index++) {
      if (ids.has(next[index]!.id) && !ids.has(next[index - 1]!.id)) [next[index], next[index - 1]] = [next[index - 1]!, next[index]!];
    }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Text layout                                                         */
/* ------------------------------------------------------------------ */

let measureContext: CanvasRenderingContext2D | null | undefined;

function measure(text: string, font: string, fontSize: number): number {
  if (measureContext === undefined) {
    try {
      measureContext = typeof document !== "undefined" && !/jsdom/i.test(navigator.userAgent) ? document.createElement("canvas").getContext("2d") : null;
    } catch {
      measureContext = null;
    }
  }
  if (!measureContext) return text.length * fontSize * 0.55;
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

/** Wraps text into lines that fit `width` for an SVG text element. Explicit newlines are kept. */
export function wrapText(text: string, width: number, { fontSize = 24, fontWeight = 400, fontFamily = "system-ui, sans-serif" } = {}): string[] {
  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/(\s+)/).filter((part) => part !== "");
    let line = "";
    for (const word of words) {
      const candidate = line + word;
      if (line && measure(candidate.trimEnd(), font, fontSize) > width) {
        lines.push(line.trimEnd());
        line = /^\s+$/.test(word) ? "" : word;
      } else {
        line = candidate;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
