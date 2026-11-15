// packages/ai-ui/src/components/signature-pad.tsx
"use client";

import { Tabs } from "@base-ui/react/tabs";
import { EraserIcon, Undo2Icon } from "lucide-react";
import { type PointerEvent, useId, useState } from "react";

import { button, buttonVariants, focusRing, input, tabList, tabTrigger } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

const WIDTH = 600;
const HEIGHT = 200;
const SCRIPT_FONT = "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', 'Apple Chancery', cursive";

export interface SignaturePoint {
  x: number;
  y: number;
}

export interface SignatureValue {
  kind: "drawn" | "typed";
  /** Standalone SVG document of the signature. */
  svg: string;
  strokes?: SignaturePoint[][];
  text?: string;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** Smooth SVG path through stroke points using quadratic curves between midpoints. */
export function strokeToPath(points: SignaturePoint[]): string {
  if (points.length === 0) return "";
  const [first] = points;
  if (points.length === 1) return `M${round(first!.x)} ${round(first!.y)}l0.1 0`;
  let path = `M${round(first!.x)} ${round(first!.y)}`;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index]!;
    const next = points[index + 1]!;
    path += `Q${round(point.x)} ${round(point.y)} ${round((point.x + next.x) / 2)} ${round((point.y + next.y) / 2)}`;
  }
  const end = points[points.length - 1]!;
  return `${path}L${round(end.x)} ${round(end.y)}`;
}

const escapeXml = (text: string) => text.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);

function drawnSvg(strokes: SignaturePoint[][], color: string): string {
  const paths = strokes.map((stroke) => `<path d="${strokeToPath(stroke)}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><g fill="none" stroke="${escapeXml(color)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

function typedSvg(text: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><text x="${WIDTH / 2}" y="${HEIGHT * 0.62}" text-anchor="middle" font-family="${escapeXml(SCRIPT_FONT)}" font-size="64" fill="${escapeXml(color)}">${escapeXml(text)}</text></svg>`;
}

/** Renders a signature SVG to a PNG blob at the given scale. */
export async function signatureToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * scale;
    canvas.height = HEIGHT * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface SignaturePadProps {
  onChange?: (signature: SignatureValue | null) => void;
  label?: string;
  /** Ink color in the exported SVG. */
  color?: string;
  /** Offers a typed signature, which also serves keyboard and screen reader users. */
  allowTyped?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Signature capture on SVG: draw with mouse, pen or touch (smoothed strokes,
 * undo, clear) or type a name rendered in a script face. Output is an SVG
 * string plus the raw strokes or text; `signatureToPng` rasterizes it.
 */
export function SignaturePad({ onChange, label = "Signature", color = "#111827", allowTyped = true, disabled = false, className }: SignaturePadProps) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [strokes, setStrokes] = useState<SignaturePoint[][]>([]);
  const [active, setActive] = useState<SignaturePoint[] | null>(null);
  const [typed, setTyped] = useState("");
  const id = useId();

  const emitDrawn = (next: SignaturePoint[][]) => onChange?.(next.length ? { kind: "drawn", svg: drawnSvg(next, color), strokes: next } : null);
  const emitTyped = (text: string) => onChange?.(text.trim() ? { kind: "typed", svg: typedSvg(text.trim(), color), text: text.trim() } : null);

  const toPoint = (event: PointerEvent<SVGSVGElement>): SignaturePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / (rect.width || WIDTH)) * WIDTH, y: ((event.clientY - rect.top) / (rect.height || HEIGHT)) * HEIGHT };
  };

  const finish = () => {
    if (!active) return;
    const next = [...strokes, active];
    setStrokes(next);
    setActive(null);
    emitDrawn(next);
  };

  const pad = (
    <div className="relative">
      {/* The pad stays light in both themes, like paper, so the ink color matches the export. */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${label} drawing area, ${strokes.length} ${strokes.length === 1 ? "stroke" : "strokes"}`}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setActive([toPoint(event)]);
        }}
        onPointerMove={(event) => {
          if (!active) return;
          const point = toPoint(event);
          const previous = active[active.length - 1]!;
          if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 1.5) setActive([...active, point]);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        className={cn("aspect-[3/1] w-full touch-none rounded-md border border-border bg-white", disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair")}
      >
        <line x1={40} x2={WIDTH - 40} y1={HEIGHT - 48} y2={HEIGHT - 48} stroke="#d4d4d8" strokeWidth={1.5} strokeDasharray="6 6" />
        <g fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          {[...strokes, ...(active ? [active] : [])].map((stroke, index) => (
            <path key={index} d={strokeToPath(stroke)} />
          ))}
        </g>
      </svg>
      {strokes.length === 0 && !active && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[30%] text-center text-sm text-neutral-600">
          Sign here
        </span>
      )}
    </div>
  );

  const drawControls = (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        disabled={disabled || strokes.length === 0}
        onClick={() => {
          const next = strokes.slice(0, -1);
          setStrokes(next);
          emitDrawn(next);
        }}
        className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}
      >
        <Undo2Icon aria-hidden="true" />
        Undo
      </button>
      <button
        type="button"
        disabled={disabled || strokes.length === 0}
        onClick={() => {
          setStrokes([]);
          emitDrawn([]);
        }}
        className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}
      >
        <EraserIcon aria-hidden="true" />
        Clear
      </button>
    </div>
  );

  if (!allowTyped) {
    return (
      <div role="group" aria-label={label} className={cn("flex flex-col gap-2", className)}>
        {pad}
        {drawControls}
      </div>
    );
  }

  return (
    <Tabs.Root
      value={mode}
      onValueChange={(next) => {
        const value = next as "draw" | "type";
        setMode(value);
        if (value === "draw") emitDrawn(strokes);
        else emitTyped(typed);
      }}
      className={cn("flex flex-col gap-2", className)}
    >
      <Tabs.List aria-label={`${label} method`} className={tabList}>
        {(["draw", "type"] as const).map((item) => (
          <Tabs.Tab key={item} value={item} className={cn(tabTrigger, focusRing)}>
            {item === "draw" ? "Draw" : "Type"}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel value="draw" className="flex flex-col gap-2 outline-none">
        {pad}
        {drawControls}
      </Tabs.Panel>
      <Tabs.Panel value="type" className="flex flex-col gap-2 outline-none">
        <label htmlFor={`${id}-typed`} className="text-xs font-medium text-muted-foreground">
          Type your full name
        </label>
        <input
          id={`${id}-typed`}
          disabled={disabled}
          value={typed}
          autoComplete="name"
          onChange={(event) => {
            setTyped(event.target.value);
            emitTyped(event.target.value);
          }}
          className={cn(input, focusRing, "focus-visible:ring-offset-0")}
        />
        <div aria-hidden="true" className="flex aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-white px-4 text-5xl" style={{ fontFamily: SCRIPT_FONT, color }}>
          {typed.trim() || <span className="text-sm text-neutral-600" style={{ fontFamily: "inherit" }}>Your signature appears here</span>}
        </div>
      </Tabs.Panel>
    </Tabs.Root>
  );
}
