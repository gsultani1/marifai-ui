// packages/ai-ui/src/components/color-picker.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Slider } from "@base-ui/react/slider";
import { PipetteIcon } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useId, useState, useSyncExternalStore } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type Hsva, hsvToRgb, parseColor, type Rgba, rgbToHsv, toHex } from "../lib/color.js";
import { usePortalContainer } from "../lib/portal.js";

const RECENT_LIMIT = 14;
const checkerboard = "bg-[conic-gradient(#d4d4d4_25%,#fafafa_0_50%,#d4d4d4_0_75%,#fafafa_0)] bg-[length:8px_8px]";
const hueGradient = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>;
}

type EyeDropperConstructor = new () => EyeDropperInstance;

const noopSubscribe = () => () => undefined;

function useEyeDropper(): EyeDropperConstructor | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper ?? null,
    () => null,
  );
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function toHsva(color: string): Hsva {
  const rgba = parseColor(color) ?? { r: 0, g: 0, b: 0, a: 1 };
  return rgbToHsv(rgba);
}

function sameColor(first: string, second: string): boolean {
  const a = parseColor(first);
  const b = parseColor(second);
  return Boolean(a && b && toHex(a) === toHex(b));
}

export interface ColorPickerPanelProps {
  value: string;
  onValueChange: (hex: string) => void;
  /** Adds an opacity slider and outputs #rrggbbaa below full opacity. */
  alpha?: boolean;
  /** Colors already used in the document, offered as swatches. */
  swatches?: string[];
  swatchesLabel?: string;
  recent?: string[];
  className?: string;
}

/**
 * Inline color editor: a saturation and brightness area (pointer or arrow
 * keys, Shift for larger steps), hue and opacity sliders, hex and RGB entry,
 * document and recent swatches, and the browser EyeDropper where supported.
 * Hue is kept while saturation or brightness is zero, so dragging back to a
 * gray does not reset it.
 */
export function ColorPickerPanel({ value, onValueChange, alpha = false, swatches = [], swatchesLabel = "Document colors", recent = [], className }: ColorPickerPanelProps) {
  const [hsva, setHsva] = useState<Hsva>(() => toHsva(value));
  const [source, setSource] = useState(value);
  const [hexText, setHexText] = useState<string | null>(null);
  const EyeDropper = useEyeDropper();
  const id = useId();

  if (value !== source) {
    setSource(value);
    if (!sameColor(value, toHex(hsvToRgb(hsva)))) setHsva(toHsva(value));
  }

  const rgba = hsvToRgb(hsva);
  const hex = toHex(alpha ? rgba : { ...rgba, a: 1 });
  const opaque = toHex({ ...rgba, a: 1 });

  const update = (next: Hsva) => {
    setHsva(next);
    const nextHex = toHex(hsvToRgb(alpha ? next : { ...next, a: 1 }));
    setSource(nextHex);
    onValueChange(nextHex);
  };

  const updateRgb = (next: Rgba) => {
    const converted = rgbToHsv(next);
    update({ ...converted, h: converted.s === 0 || converted.v === 0 ? hsva.h : converted.h });
  };

  const pickFromArea = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    update({ ...hsva, s: clamp01((event.clientX - rect.left) / rect.width), v: 1 - clamp01((event.clientY - rect.top) / rect.height) });
  };

  const onAreaKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, Partial<Hsva>> = {
      ArrowLeft: { s: clamp01(hsva.s - step) },
      ArrowRight: { s: clamp01(hsva.s + step) },
      ArrowUp: { v: clamp01(hsva.v + step) },
      ArrowDown: { v: clamp01(hsva.v - step) },
      Home: { s: 0 },
      End: { s: 1 },
      PageUp: { v: 1 },
      PageDown: { v: 0 },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    update({ ...hsva, ...move });
  };

  const swatch = (color: string, group: string) => {
    const parsed = parseColor(color);
    if (!parsed) return null;
    const swatchHex = toHex(parsed);
    return (
      <button
        key={`${group}-${swatchHex}`}
        type="button"
        aria-label={swatchHex}
        aria-pressed={swatchHex === hex}
        onClick={() => updateRgb(alpha ? parsed : { ...parsed, a: 1 })}
        className={cn("relative size-6 overflow-hidden rounded-md border border-border aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-1 aria-pressed:ring-offset-background", checkerboard, focusRing)}
      >
        <span aria-hidden="true" className="absolute inset-0" style={{ background: swatchHex }} />
      </button>
    );
  };

  const channelInput = (label: string, short: string, channel: "r" | "g" | "b") => (
    <label className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={255}
        aria-label={label}
        value={rgba[channel]}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(next)) updateRgb({ ...rgba, [channel]: Math.min(255, Math.max(0, next)) });
        }}
        className="h-7 w-full min-w-0 rounded-md border border-input bg-background px-1 text-center text-xs text-foreground tabular-nums outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span aria-hidden="true">{short}</span>
    </label>
  );

  const parsedText = hexText === null ? null : parseColor(hexText);

  return (
    <div className={cn("flex w-60 flex-col gap-3", className)}>
      <div
        className="relative h-36 w-full cursor-crosshair touch-none rounded-md"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsva.h} 100% 50%))` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          pickFromArea(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) pickFromArea(event);
        }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsva.s * 100)}
          aria-valuetext={`Saturation ${Math.round(hsva.s * 100)}%, brightness ${Math.round(hsva.v * 100)}%`}
          onKeyDown={onAreaKey}
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%`, background: opaque }}
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <Slider.Root value={Math.round(hsva.h)} min={0} max={359} onValueChange={(next) => update({ ...hsva, h: next as number })}>
            <Slider.Control className="flex h-4 touch-none items-center select-none">
              <Slider.Track className="relative h-3 w-full rounded-full" style={{ background: hueGradient }}>
                <Slider.Thumb aria-label="Hue" getAriaValueText={(formatted: string) => `${formatted} degrees`} className="size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)] outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring" style={{ background: `hsl(${hsva.h} 100% 50%)` }} />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
          {alpha && (
            <Slider.Root value={Math.round(hsva.a * 100)} min={0} max={100} onValueChange={(next) => update({ ...hsva, a: (next as number) / 100 })}>
              <Slider.Control className="flex h-4 touch-none items-center select-none">
                <Slider.Track className={cn("relative h-3 w-full rounded-full", checkerboard)}>
                  <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, transparent, ${opaque})` }} />
                  <Slider.Thumb aria-label="Opacity" getAriaValueText={(formatted: string) => `${formatted}%`} className={cn("size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)] outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", checkerboard)} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          )}
        </div>
        <span aria-hidden="true" className={cn("relative size-9 shrink-0 overflow-hidden rounded-md border border-border", checkerboard)}>
          <span className="absolute inset-0" style={{ background: hex }} />
        </span>
      </div>
      <div className="flex items-end gap-1.5">
        <label className="flex min-w-0 flex-[1.6] flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
          <input
            id={`${id}-hex`}
            aria-label="Hex color"
            spellCheck={false}
            value={hexText ?? hex}
            aria-invalid={hexText !== null && !parsedText}
            onFocus={(event) => {
              setHexText(hex);
              event.currentTarget.select();
            }}
            onChange={(event) => {
              setHexText(event.target.value);
              const parsed = parseColor(event.target.value);
              if (parsed) updateRgb(alpha ? parsed : { ...parsed, a: 1 });
            }}
            onBlur={() => setHexText(null)}
            onKeyDown={(event) => event.key === "Enter" && setHexText(null)}
            className="h-7 w-full min-w-0 rounded-md border border-input bg-background px-1.5 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive"
          />
          <span aria-hidden="true">Hex</span>
        </label>
        {channelInput("Red", "R", "r")}
        {channelInput("Green", "G", "g")}
        {channelInput("Blue", "B", "b")}
        {EyeDropper && (
          <button
            type="button"
            aria-label="Pick a color from the screen"
            onClick={() => {
              new EyeDropper()
                .open()
                .then((result) => {
                  const parsed = parseColor(result.sRGBHex);
                  if (parsed) updateRgb({ ...parsed, a: hsva.a });
                })
                .catch(() => undefined);
            }}
            className={cn(iconButton, "mb-3.5 size-7", focusRing)}
          >
            <PipetteIcon aria-hidden="true" />
          </button>
        )}
      </div>
      {swatches.length > 0 && (
        <div role="group" aria-label={swatchesLabel} className="flex flex-col gap-1">
          <span aria-hidden="true" className="text-[10px] font-medium text-muted-foreground uppercase">
            {swatchesLabel}
          </span>
          <div className="flex flex-wrap gap-1.5">{swatches.map((color) => swatch(color, "doc"))}</div>
        </div>
      )}
      {recent.length > 0 && (
        <div role="group" aria-label="Recent colors" className="flex flex-col gap-1">
          <span aria-hidden="true" className="text-[10px] font-medium text-muted-foreground uppercase">
            Recent
          </span>
          <div className="flex flex-wrap gap-1.5">{recent.map((color) => swatch(color, "recent"))}</div>
        </div>
      )}
    </div>
  );
}

function readRecent(key: string | undefined): string[] {
  if (!key || typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export interface ColorPickerProps extends Omit<ColorPickerPanelProps, "value" | "onValueChange" | "recent" | "className"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (hex: string) => void;
  label: string;
  /** Remembers the last 14 chosen colors in localStorage under this key. */
  recentStorageKey?: string;
  disabled?: boolean;
  className?: string;
}

/** Swatch button that opens ColorPickerPanel in a popover and records the chosen color as recent when it closes. */
export function ColorPicker({ value, defaultValue = "#000000", onValueChange, label, recentStorageKey, disabled = false, className, ...panel }: ColorPickerProps) {
  const [color, setColor] = useControllableState<string>({ value, defaultValue, onChange: onValueChange });
  const [recent, setRecent] = useState<string[]>(() => readRecent(recentStorageKey));
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const container = usePortalContainer();
  const id = useId();
  const parsed = parseColor(color);
  const display = parsed ? toHex(parsed) : color;

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Popover.Root
        open={openedWith !== null}
        onOpenChange={(open) => {
          if (open) {
            setOpenedWith(color);
            return;
          }
          if (openedWith !== null && !sameColor(openedWith, color) && parsed) {
            const next = [toHex(parsed), ...recent.filter((item) => !sameColor(item, color))].slice(0, RECENT_LIMIT);
            setRecent(next);
            if (recentStorageKey) {
              try {
                window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
              } catch {
                // Storage can be unavailable (private mode, quota); recent colors then last for the session.
              }
            }
          }
          setOpenedWith(null);
        }}
      >
        <Popover.Trigger disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} className={cn("inline-flex h-9 min-w-36 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm hover:bg-accent/40 disabled:opacity-50 data-[popup-open]:ring-2 data-[popup-open]:ring-ring", focusRing)}>
          <span aria-hidden="true" className={cn("relative size-5 shrink-0 overflow-hidden rounded border border-border", checkerboard)}>
            <span className="absolute inset-0" style={{ background: display }} />
          </span>
          <span id={`${id}-value`} className="font-mono text-xs">
            {display}
          </span>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Positioner sideOffset={6} align="start" className="z-50">
            <Popover.Popup aria-label={label} className={cn(popupSurface, "p-3 outline-none")}>
              <ColorPickerPanel {...panel} value={color} onValueChange={setColor} recent={recent} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
