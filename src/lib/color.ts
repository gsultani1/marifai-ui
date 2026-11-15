// packages/ai-ui/src/lib/color.ts
/** Red, green and blue in 0–255 and alpha in 0–1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Hue in degrees, saturation, value and alpha in 0–1. */
export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A number or percentage with nothing after it; parseFloat alone would accept "3) junk". */
function channel(text: string, max: number): number | null {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(%?)$/.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  return clamp(match[2] ? (amount / 100) * max : amount, 0, max);
}

function alphaChannel(text: string | undefined): number | null {
  if (text === undefined) return 1;
  return channel(text, 1);
}

function hue(text: string): number | null {
  const match = /^(-?[\d.]+)(deg|turn|rad)?$/.exec(text);
  if (!match) return null;
  const value = Number.parseFloat(match[1]!);
  if (!Number.isFinite(value)) return null;
  const degrees = match[2] === "turn" ? value * 360 : match[2] === "rad" ? (value * 180) / Math.PI : value;
  return ((degrees % 360) + 360) % 360;
}

function functionArgs(input: string, names: string[]): string[] | null {
  const match = /^([a-z]+)\((.*)\)$/i.exec(input);
  if (!match || !names.includes(match[1]!.toLowerCase())) return null;
  const body = match[2]!.trim();
  const [main, slashAlpha] = body.split("/").map((part) => part.trim());
  const parts = main!.includes(",") ? main!.split(",").map((part) => part.trim()) : main!.split(/\s+/);
  if (slashAlpha !== undefined) parts.push(slashAlpha);
  return parts.filter(Boolean);
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() and hsl()/hsla() in comma or space syntax. */
export function parseColor(input: string): Rgba | null {
  const text = input.trim().toLowerCase();
  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    let digits = hex[1]!;
    if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
    const value = (offset: number) => Number.parseInt(digits.slice(offset, offset + 2), 16);
    return { r: value(0), g: value(2), b: value(4), a: digits.length === 8 ? Math.round((value(6) / 255) * 1000) / 1000 : 1 };
  }
  const rgb = functionArgs(text, ["rgb", "rgba"]);
  if (rgb) {
    if (rgb.length < 3 || rgb.length > 4) return null;
    const [r, g, b] = rgb.slice(0, 3).map((part) => channel(part, 255));
    const a = alphaChannel(rgb[3]);
    if (r == null || g == null || b == null || a == null) return null;
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
  }
  const hsl = functionArgs(text, ["hsl", "hsla"]);
  if (hsl) {
    if (hsl.length < 3 || hsl.length > 4) return null;
    const h = hue(hsl[0]!);
    const s = channel(hsl[1]!.endsWith("%") ? hsl[1]! : `${hsl[1]}%`, 1);
    const l = channel(hsl[2]!.endsWith("%") ? hsl[2]! : `${hsl[2]}%`, 1);
    const a = alphaChannel(hsl[3]);
    if (h == null || s == null || l == null || a == null) return null;
    return { ...hslToRgb(h, s, l), a };
  }
  return null;
}

const hexByte = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

/** Lowercase #rrggbb, or #rrggbbaa when alpha is below 1. */
export function toHex({ r, g, b, a }: Rgba): string {
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${a < 1 ? hexByte(a * 255) : ""}`;
}

export function formatRgb({ r, g, b, a }: Rgba): string {
  return a < 1 ? `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${Math.round(a * 100)}%)` : `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

export function rgbToHsv({ r, g, b, a }: Rgba): Hsva {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? delta / max : 0, v: max, a };
}

export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return { r: f(5), g: f(3), b: f(1), a };
}

/** WCAG relative luminance of an sRGB color. */
export function relativeLuminance({ r, g, b }: Pick<Rgba, "r" | "g" | "b">): number {
  const linear = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two opaque colors, from 1 to 21. */
export function contrastRatio(first: Pick<Rgba, "r" | "g" | "b">, second: Pick<Rgba, "r" | "g" | "b">): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}
