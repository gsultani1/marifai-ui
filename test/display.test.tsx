// packages/ai-ui/test/display.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildHeatmapMatrix, CalendarHeatmap, heatmapColor, heatmapLevel } from "../src/components/calendar-heatmap.js";
import { Carousel, CarouselSlide, resolveSlidesPerView } from "../src/components/carousel.js";
import { CircularProgress } from "../src/components/circular-progress.js";
import { Countdown, splitDuration, Timer } from "../src/components/countdown.js";
import { DescriptionList } from "../src/components/description-list.js";
import { InfiniteScroll } from "../src/components/infinite-scroll.js";
import { Marquee } from "../src/components/marquee.js";
import { computeMasonryLayout, Masonry, masonryColumnCount } from "../src/components/masonry.js";
import { QRCode } from "../src/components/qr-code.js";
import { moveItem, SortableList } from "../src/components/sortable-list.js";
import { TransferList } from "../src/components/transfer-list.js";
import { computeTreeCheckState, flattenVisibleTree, toggleTreeChecked, type TreeNode, TreeView } from "../src/components/tree-view.js";
import { computeVirtualRange, VirtualList, type VirtualListHandle } from "../src/components/virtual-list.js";
import { encodeQR, type QRErrorCorrectionLevel, qrSvgPath, qrToSvgString } from "../src/lib/qr-code.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/* ------------------------------------------------------------------ */
/* Test-only QR reader, written independently of the encoder           */
/* ------------------------------------------------------------------ */

const LEVELS: QRErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

const ALIGNMENT: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

/** [EC codewords per block, block count] by level, from ISO/IEC 18004 table 9. */
const EC_PER_BLOCK: Record<QRErrorCorrectionLevel, number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOCKS: Record<QRErrorCorrectionLevel, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const EXP: number[] = [];
const LOG: number[] = new Array<number>(256).fill(0);
{
  let value = 1;
  for (let index = 0; index < 255; index++) {
    EXP[index] = value;
    LOG[value] = index;
    value = value * 2 >= 256 ? (value * 2) ^ 0x11d : value * 2;
  }
}
const mul = (a: number, b: number) => (a && b ? EXP[(LOG[a]! + LOG[b]!) % 255]! : 0);

function bchRemainder(value: number, generator: number, degree: number): number {
  let remainder = value << degree;
  const top = Math.floor(Math.log2(generator));
  for (let bit = 30; bit >= top; bit--) if ((remainder >>> bit) & 1) remainder ^= generator << (bit - top);
  return remainder;
}

function functionMap(version: number): boolean[][] {
  const size = version * 4 + 17;
  const map = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < size && y < size) map[y]![x] = true;
  };
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) mark(x, y);
  for (let y = 0; y < 9; y++) for (let x = size - 8; x < size; x++) mark(x, y);
  for (let y = size - 8; y < size; y++) for (let x = 0; x < 9; x++) mark(x, y);
  for (let index = 0; index < size; index++) {
    mark(6, index);
    mark(index, 6);
  }
  const centers = ALIGNMENT[version]!;
  for (const cy of centers) {
    for (const cx of centers) {
      if ((cx < 9 && cy < 9) || (cx > size - 9 && cy < 9) || (cx < 9 && cy > size - 9)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(cx + dx, cy + dy);
    }
  }
  if (version >= 7) {
    for (let a = size - 11; a < size - 8; a++) {
      for (let b = 0; b < 6; b++) {
        mark(a, b);
        mark(b, a);
      }
    }
  }
  return map;
}

function unmask(mask: number, x: number, y: number): boolean {
  const rules = [
    () => (y + x) % 2 === 0,
    () => y % 2 === 0,
    () => x % 3 === 0,
    () => (y + x) % 3 === 0,
    () => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    () => ((y * x) % 2) + ((y * x) % 3) === 0,
    () => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
    () => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
  ];
  return rules[mask]!();
}

interface Decoded {
  text: string;
  version: number;
  level: QRErrorCorrectionLevel;
  mask: number;
  mode: string;
  eci: number | null;
}

function readQR(modules: boolean[][]): Decoded {
  const size = modules.length;
  const version = (size - 17) / 4;
  expect(Number.isInteger(version)).toBe(true);
  const at = (x: number, y: number) => modules[y]![x]!;

  let first = 0;
  let second = 0;
  const firstCoordinates: Array<[number, number]> = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  firstCoordinates.forEach(([x, y], bit) => {
    if (at(x, y)) first |= 1 << bit;
  });
  for (let bit = 0; bit < 8; bit++) if (at(size - 1 - bit, 8)) second |= 1 << bit;
  for (let bit = 8; bit < 15; bit++) if (at(8, size - 15 + bit)) second |= 1 << bit;
  expect(second).toBe(first);
  expect(at(8, size - 8)).toBe(true);
  const unmasked = first ^ 0x5412;
  const data = unmasked >>> 10;
  expect(unmasked & 0x3ff).toBe(bchRemainder(data, 0x537, 10));
  const level = (["M", "L", "H", "Q"] as const)[data >>> 3]!;
  const mask = data & 7;

  if (version >= 7) {
    let lower = 0;
    let upper = 0;
    for (let bit = 0; bit < 18; bit++) {
      const a = size - 11 + (bit % 3);
      const b = Math.floor(bit / 3);
      if (at(a, b)) upper |= 1 << bit;
      if (at(b, a)) lower |= 1 << bit;
    }
    expect(lower).toBe(upper);
    expect(upper >>> 12).toBe(version);
    expect(upper & 0xfff).toBe(bchRemainder(version, 0x1f25, 12));
  }

  const reserved = functionMap(version);
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y]![x]) continue;
        bits.push(at(x, y) !== unmask(mask, x, y) ? 1 : 0);
      }
    }
  }
  const total = Math.floor(bits.length / 8);
  const codewords = Array.from({ length: total }, (_, index) => bits.slice(index * 8, index * 8 + 8).reduce((byte, bit) => (byte << 1) | bit, 0));

  const blockCount = BLOCKS[level][version]!;
  const ecLength = EC_PER_BLOCK[level][version]!;
  const shortBlocks = blockCount - (total % blockCount);
  const shortData = Math.floor(total / blockCount) - ecLength;
  const blocks = Array.from({ length: blockCount }, (_, index) => ({ data: [] as number[], ec: [] as number[], dataLength: shortData + (index < shortBlocks ? 0 : 1) }));
  let cursor = 0;
  for (let index = 0; index <= shortData; index++) {
    for (const block of blocks) if (index < block.dataLength) block.data.push(codewords[cursor++]!);
  }
  for (let index = 0; index < ecLength; index++) for (const block of blocks) block.ec.push(codewords[cursor++]!);
  expect(cursor).toBe(total);

  for (const block of blocks) {
    const word = [...block.data, ...block.ec];
    for (let root = 0; root < ecLength; root++) {
      let syndrome = 0;
      for (const value of word) syndrome = mul(syndrome, EXP[root]!) ^ value;
      expect(syndrome).toBe(0);
    }
  }

  const stream = blocks.flatMap((block) => block.data).flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1));
  let position = 0;
  const read = (length: number) => {
    let value = 0;
    for (let index = 0; index < length; index++) value = (value << 1) | (stream[position++] ?? 0);
    return value;
  };
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  let modeBits = read(4);
  let eci: number | null = null;
  if (modeBits === 0b0111) {
    eci = read(8);
    modeBits = read(4);
  }
  let text = "";
  let mode = "";
  if (modeBits === 0b0001) {
    mode = "numeric";
    let count = read([10, 12, 14][band]!);
    while (count >= 3) {
      text += String(read(10)).padStart(3, "0");
      count -= 3;
    }
    if (count === 2) text += String(read(7)).padStart(2, "0");
    if (count === 1) text += String(read(4));
  } else if (modeBits === 0b0010) {
    mode = "alphanumeric";
    const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
    let count = read([9, 11, 13][band]!);
    while (count >= 2) {
      const pair = read(11);
      text += charset[Math.floor(pair / 45)]! + charset[pair % 45]!;
      count -= 2;
    }
    if (count === 1) text += charset[read(6)]!;
  } else if (modeBits === 0b0100) {
    mode = "byte";
    const count = read([8, 16, 16][band]!);
    const bytes = Uint8Array.from({ length: count }, () => read(8));
    text = new TextDecoder(eci === 26 || eci === null ? "utf-8" : "latin1").decode(bytes);
  } else {
    throw new Error(`Unexpected mode ${modeBits}`);
  }
  const remaining = stream.length - position;
  if (remaining > 0) expect(read(Math.min(4, remaining))).toBe(0);
  return { text, version, level, mask, mode, eci };
}

function expectFinder(modules: boolean[][], left: number, top: number) {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      expect(modules[top + dy]![left + dx]).toBe(ring !== 2);
    }
  }
}

describe("QR encoder", () => {
  const samples: Array<{ text: string; mode: string }> = [
    { text: "Claw hammer, 16 oz", mode: "byte" },
    { text: "https://example.com/store", mode: "byte" },
    { text: "0123456789012345", mode: "numeric" },
    { text: "AISLE 7: 3/8 IN BOLTS $4.99", mode: "alphanumeric" },
    { text: "Señor Pérez, café crème, 工具箱", mode: "byte" },
    { text: "", mode: "numeric" },
  ];

  for (const level of LEVELS) {
    it(`round-trips every mode at level ${level}`, () => {
      for (const sample of samples) {
        const matrix = encodeQR(sample.text, { ecLevel: level });
        const decoded = readQR(matrix.modules);
        expect(decoded.text).toBe(sample.text);
        expect(decoded.mode).toBe(sample.mode);
        expect(decoded.level).toBe(level);
        expect(decoded.version).toBe(matrix.version);
        expect(decoded.mask).toBe(matrix.mask);
        expect(matrix.mode).toBe(sample.mode);
        expect(decoded.eci).toBe(sample.text === "Señor Pérez, café crème, 工具箱" ? 26 : null);
      }
    });

    it(`forces versions 1, 7 and 40 at level ${level}`, () => {
      const one = encodeQR("HI", { ecLevel: level });
      expect(one.version).toBe(1);
      expect(one.size).toBe(21);
      expect(readQR(one.modules).text).toBe("HI");

      const seven = encodeQR("Pick list 4471", { ecLevel: level, minVersion: 7 });
      expect(seven.version).toBe(7);
      expect(readQR(seven.modules)).toMatchObject({ text: "Pick list 4471", version: 7 });

      const forty = encodeQR("https://example.com/store?aisle=12&bin=4", { ecLevel: level, minVersion: 40 });
      expect(forty.version).toBe(40);
      expect(forty.size).toBe(177);
      expect(readQR(forty.modules).text).toBe("https://example.com/store?aisle=12&bin=4");
    });
  }

  it("fills version 40 to its documented capacity and rejects one more character", () => {
    const capacities: Array<[QRErrorCorrectionLevel, number]> = [
      ["L", 2953],
      ["H", 1273],
    ];
    for (const [level, bytes] of capacities) {
      const text = "a".repeat(bytes);
      const matrix = encodeQR(text, { ecLevel: level });
      expect(matrix.version).toBe(40);
      expect(readQR(matrix.modules).text).toBe(text);
      expect(() => encodeQR(text + "a", { ecLevel: level })).toThrow(RangeError);
    }
    expect(encodeQR("7".repeat(7089), { ecLevel: "L" }).version).toBe(40);
    expect(() => encodeQR("7".repeat(7090), { ecLevel: "L" })).toThrow(/too long for a QR code/);
    expect(encodeQR("Z".repeat(4296), { ecLevel: "L" }).version).toBe(40);
    expect(() => encodeQR("Z".repeat(4297), { ecLevel: "L" })).toThrow(/version 40 at error correction level L/);
  });

  it("matches the documented version 1 to 3 capacities", () => {
    const limits: Record<QRErrorCorrectionLevel, [number, number, number]> = { L: [17, 32, 53], M: [14, 26, 42], Q: [11, 20, 32], H: [7, 14, 24] };
    for (const level of LEVELS) {
      limits[level].forEach((bytes, index) => {
        expect(encodeQR("b".repeat(bytes), { ecLevel: level }).version).toBe(index + 1);
        expect(encodeQR("b".repeat(bytes + 1), { ecLevel: level }).version).toBe(index + 2);
      });
    }
    expect(encodeQR("1".repeat(41), { ecLevel: "L" }).version).toBe(1);
    expect(encodeQR("1".repeat(42), { ecLevel: "L" }).version).toBe(2);
    expect(encodeQR("A".repeat(25), { ecLevel: "L" }).version).toBe(1);
    expect(encodeQR("A".repeat(26), { ecLevel: "L" }).version).toBe(2);
  });

  it("draws finder, timing, alignment and version patterns for every version", () => {
    for (let version = 1; version <= 40; version++) {
      const { modules, size } = encodeQR("1", { minVersion: version, ecLevel: "L" });
      expect(size).toBe(version * 4 + 17);
      expectFinder(modules, 0, 0);
      expectFinder(modules, size - 7, 0);
      expectFinder(modules, 0, size - 7);
      for (let index = 0; index < 8; index++) {
        expect(modules[7]![index]).toBe(false);
        expect(modules[index]![7]).toBe(false);
        expect(modules[7]![size - 1 - index]).toBe(false);
        expect(modules[size - 8]![index]).toBe(false);
      }
      for (let index = 8; index < size - 8; index++) {
        expect(modules[6]![index]).toBe(index % 2 === 0);
        expect(modules[index]![6]).toBe(index % 2 === 0);
      }
      const centers = ALIGNMENT[version]!;
      for (const cy of centers) {
        for (const cx of centers) {
          if ((cx < 9 && cy < 9) || (cx > size - 9 && cy < 9) || (cx < 9 && cy > size - 9)) continue;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) expect(modules[cy + dy]![cx + dx]).toBe(Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
      expect(readQR(modules).text).toBe("1");
    }
  });

  it("writes the known version 7 and 40 information words", () => {
    const read = (version: number) => {
      const { modules, size } = encodeQR("1", { minVersion: version });
      let bits = 0;
      for (let bit = 0; bit < 18; bit++) if (modules[Math.floor(bit / 3)]![size - 11 + (bit % 3)]) bits |= 1 << bit;
      return bits;
    };
    expect(read(7)).toBe(0x07c94);
    expect(read(40)).toBe(0x28c69);
  });

  it("honours a forced mask and rejects invalid masks", () => {
    for (let mask = 0; mask < 8; mask++) {
      const matrix = encodeQR("Order 1042", { mask });
      expect(matrix.mask).toBe(mask);
      expect(readQR(matrix.modules)).toMatchObject({ text: "Order 1042", mask });
    }
    expect(() => encodeQR("x", { mask: 8 })).toThrow(RangeError);
  });

  it("builds compact SVG path data and a standalone document", () => {
    expect(qrSvgPath([[true, true, false, true]], 1)).toBe("M1 1h2v1h-2zM4 1h1v1h-1z");
    const matrix = encodeQR("https://example.com/store");
    const svg = qrToSvgString(matrix, { foreground: 'a"b', size: 200 });
    expect(svg).toContain('viewBox="0 0 33 33"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('fill="a&quot;b"');
  });
});

describe("QRCode", () => {
  it("renders an SVG image with an accessible name and quiet zone", () => {
    render(<QRCode value="https://example.com/store" size={120} />);
    const image = screen.getByRole("img", { name: "QR code for https://example.com/store" });
    expect(image.getAttribute("viewBox")).toBe("0 0 33 33");
    expect(image.getAttribute("width")).toBe("120");
    expect(image.querySelector("rect")?.getAttribute("fill")).toBe("#ffffff");
    expect(image.querySelector("path")?.getAttribute("fill")).toBe("#000000");
  });

  it("offers SVG and PNG downloads", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<QRCode value="https://example.com/store" label="Store QR code" downloadable fileName="store" />);
    fireEvent.click(screen.getByRole("button", { name: "Download Store QR code as SVG" }));
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("store.svg");
    expect(screen.getByRole("button", { name: "Download Store QR code as PNG" })).toBeTruthy();
  });

  it("shows an alert instead of throwing for oversized input", () => {
    render(<QRCode value={"x".repeat(3000)} ecLevel="H" />);
    expect(screen.getByRole("alert").textContent).toContain("too long for a QR code");
  });
});

/* ------------------------------------------------------------------ */
/* Carousel                                                            */
/* ------------------------------------------------------------------ */

function liveRegion(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>("[aria-live]")!;
}

function slideElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-slot="carousel-slide"]')];
}

function PhotoCarousel(props: Partial<Parameters<typeof Carousel>[0]>) {
  return (
    <Carousel label="Product photos" {...props}>
      <CarouselSlide label="Front">Front of the drill</CarouselSlide>
      <CarouselSlide label="Side">Side of the drill</CarouselSlide>
      <CarouselSlide label="Back">Back of the drill</CarouselSlide>
      <CarouselSlide label="Case">Carry case</CarouselSlide>
    </Carousel>
  );
}

describe("Carousel", () => {
  it("resolves responsive slides per view", () => {
    expect(resolveSlidesPerView(2.7, 0)).toBe(2);
    expect(resolveSlidesPerView(0, 0)).toBe(1);
    const breakpoints = { 0: 1, 640: 2, 1024: 3 };
    expect(resolveSlidesPerView(breakpoints, 500)).toBe(1);
    expect(resolveSlidesPerView(breakpoints, 640)).toBe(2);
    expect(resolveSlidesPerView(breakpoints, 2000)).toBe(3);
    expect(resolveSlidesPerView({ 640: 2 }, 300)).toBe(2);
    expect(resolveSlidesPerView({}, 300)).toBe(1);
  });

  it("labels the carousel and slides, and makes hidden slides inert", () => {
    const { container } = render(<PhotoCarousel />);
    const region = screen.getByRole("region", { name: "Product photos" });
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
    const slides = slideElements(container);
    expect(slides).toHaveLength(4);
    expect(slides[0]!.getAttribute("aria-roledescription")).toBe("slide");
    expect(slides[0]!.getAttribute("aria-label")).toBe("Front, 1 of 4");
    expect(slides[0]!.hasAttribute("aria-hidden")).toBe(false);
    expect(slides[1]!.getAttribute("aria-hidden")).toBe("true");
    expect(slides[1]!.hasAttribute("inert")).toBe(true);
    expect(liveRegion(container).getAttribute("aria-live")).toBe("polite");
  });

  it("moves with buttons, dots and the keyboard, and stops at the ends without loop", () => {
    const onIndexChange = vi.fn();
    const { container } = render(<PhotoCarousel onIndexChange={onIndexChange} />);
    const previous = screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    fireEvent.click(next);
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(liveRegion(container).textContent).toBe("Slide 2 of 4: Side");
    fireEvent.click(screen.getByRole("button", { name: "Show slide 3: Back" }));
    expect(screen.getByRole("button", { name: "Show slide 3: Back" }).getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(next, { key: "End" });
    expect(liveRegion(container).textContent).toBe("Slide 4 of 4: Case");
    expect(next.disabled).toBe(true);
    fireEvent.keyDown(previous, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenLastCalledWith(3);
    fireEvent.keyDown(previous, { key: "Home" });
    expect(liveRegion(container).textContent).toBe("Slide 1 of 4: Front");
    fireEvent.keyDown(previous, { key: "ArrowLeft" });
    expect(liveRegion(container).textContent).toBe("Slide 1 of 4: Front");
  });

  it("wraps around with loop", () => {
    const { container } = render(<PhotoCarousel loop />);
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(liveRegion(container).textContent).toBe("Slide 4 of 4: Case");
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(liveRegion(container).textContent).toBe("Slide 1 of 4: Front");
  });

  it("stays controlled", () => {
    const onIndexChange = vi.fn();
    const { container } = render(<PhotoCarousel index={1} onIndexChange={onIndexChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(slideElements(container)[1]!.hasAttribute("data-active")).toBe(true);
    expect(slideElements(container)[2]!.hasAttribute("data-active")).toBe(false);
  });

  it("shows several slides per view and a thumbnail picker from items", () => {
    const items = ["Front view", "Side view", "Back view", "In use"].map((label, position) => ({ id: `photo-${position}`, label, content: <div>{label}</div>, thumbnail: <span>{position + 1}</span> }));
    const { container } = render(<Carousel label="Drill photos" items={items} slidesPerView={2} picker="thumbnails" />);
    const slides = slideElements(container);
    expect(slides.filter((slide) => slide.hasAttribute("data-active"))).toHaveLength(2);
    expect(liveRegion(container).textContent).toBe("Slides 1 to 2 of 4");
    fireEvent.click(screen.getByRole("button", { name: "Show slide 4: In use" }));
    expect(liveRegion(container).textContent).toBe("Slides 3 to 4 of 4");
    expect(screen.getByRole("button", { name: "Show slide 3: Back view" }).getAttribute("aria-current")).toBe("true");
  });

  it("advances on a pointer swipe", () => {
    const { container } = render(<PhotoCarousel />);
    const viewport = container.querySelector('[data-slot="carousel-track"]')!.parentElement!;
    fireEvent.pointerDown(viewport, { button: 0, pointerId: 3, clientX: 220, clientY: 40 });
    fireEvent.pointerMove(viewport, { pointerId: 3, clientX: 150, clientY: 42 });
    fireEvent.pointerMove(viewport, { pointerId: 3, clientX: 90, clientY: 44 });
    fireEvent.pointerUp(viewport, { pointerId: 3, clientX: 90, clientY: 44 });
    expect(liveRegion(container).textContent).toBe("Slide 2 of 4: Side");
  });

  it("autoplays, pauses on hover and with the pause button", () => {
    vi.useFakeTimers();
    const { container } = render(<PhotoCarousel autoplay={3000} />);
    const region = screen.getByRole("region", { name: "Product photos" });
    expect(liveRegion(container).getAttribute("aria-live")).toBe("off");
    act(() => vi.advanceTimersByTime(3000));
    expect(liveRegion(container).textContent).toBe("Slide 2 of 4: Side");
    fireEvent.pointerEnter(region, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(6000));
    expect(liveRegion(container).textContent).toBe("Slide 2 of 4: Side");
    fireEvent.pointerLeave(region, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(3000));
    expect(liveRegion(container).textContent).toBe("Slide 3 of 4: Back");
    fireEvent.click(screen.getByRole("button", { name: "Pause automatic slide show" }));
    expect(liveRegion(container).getAttribute("aria-live")).toBe("polite");
    act(() => vi.advanceTimersByTime(9000));
    expect(liveRegion(container).textContent).toBe("Slide 3 of 4: Back");
    fireEvent.click(screen.getByRole("button", { name: "Start automatic slide show" }));
    act(() => vi.advanceTimersByTime(3000));
    expect(liveRegion(container).textContent).toBe("Slide 4 of 4: Case");
    act(() => vi.advanceTimersByTime(3000));
    expect(liveRegion(container).textContent).toBe("Slide 1 of 4: Front");
  });

  it("pauses autoplay while focus is inside", () => {
    vi.useFakeTimers();
    const { container } = render(<PhotoCarousel autoplay={3000} />);
    act(() => screen.getByRole("button", { name: "Next slide" }).focus());
    act(() => vi.advanceTimersByTime(6000));
    expect(liveRegion(container).textContent).toBe("Slide 1 of 4: Front");
  });

  it("never starts autoplay or animates under reduced motion", () => {
    stubReducedMotion(true);
    vi.useFakeTimers();
    const { container } = render(<PhotoCarousel autoplay={3000} />);
    act(() => vi.advanceTimersByTime(9000));
    expect(liveRegion(container).textContent).toBe("Slide 1 of 4: Front");
    expect(screen.getByRole("button", { name: "Start automatic slide show" })).toBeTruthy();
    expect(container.querySelector('[data-slot="carousel-track"]')!.className).not.toContain("transition-transform");
  });
});

/* ------------------------------------------------------------------ */
/* TreeView                                                            */
/* ------------------------------------------------------------------ */

const CATEGORIES: TreeNode[] = [
  {
    id: "tools",
    label: "Hand tools",
    children: [
      { id: "hammers", label: "Hammers" },
      { id: "saws", label: "Saws" },
      { id: "wrenches", label: "Wrenches" },
    ],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    children: [
      { id: "pipe", label: "Pipe and fittings" },
      { id: "valves", label: "Valves" },
    ],
  },
  { id: "paint", label: "Paint" },
];

const item = (name: string) => screen.getByRole("treeitem", { name });

describe("tree helpers", () => {
  it("flattens only visible nodes with ARIA positions", () => {
    const flat = flattenVisibleTree(CATEGORIES, new Set(["tools"]));
    expect(flat.map((entry) => entry.node.id)).toEqual(["tools", "hammers", "saws", "wrenches", "plumbing", "paint"]);
    expect(flat[0]).toMatchObject({ level: 1, posinset: 1, setsize: 3, expandable: true, expanded: true, parentId: null });
    expect(flat[2]).toMatchObject({ level: 2, posinset: 2, setsize: 3, expandable: false, parentId: "tools" });
    expect(flat[4]).toMatchObject({ expandable: true, expanded: false });
    expect(flattenVisibleTree([], new Set())).toEqual([]);
  });

  it("uses loaded children and treats an empty load as a leaf", () => {
    const nodes: TreeNode[] = [
      { id: "fasteners", label: "Fasteners", hasChildren: true },
      { id: "rope", label: "Rope", hasChildren: true },
    ];
    const loaded = new Map([
      ["fasteners", [{ id: "nails", label: "Nails" }]],
      ["rope", []],
    ]);
    const flat = flattenVisibleTree(nodes, new Set(["fasteners", "rope"]), loaded);
    expect(flat.map((entry) => entry.node.id)).toEqual(["fasteners", "nails", "rope"]);
    expect(flat[2]).toMatchObject({ expandable: false, expanded: false });
    expect(flattenVisibleTree(nodes, new Set())[0]).toMatchObject({ expandable: true, expanded: false });
  });

  it("derives tri-state checkbox values", () => {
    const states = computeTreeCheckState(CATEGORIES, new Set(["hammers", "pipe", "valves"]));
    expect(states.get("hammers")).toBe("checked");
    expect(states.get("tools")).toBe("mixed");
    expect(states.get("plumbing")).toBe("checked");
    expect(states.get("paint")).toBe("unchecked");
  });

  it("cascades checks down and up, skipping disabled descendants", () => {
    let checked = toggleTreeChecked(CATEGORIES, new Set(), "tools");
    expect([...checked].sort()).toEqual(["hammers", "saws", "tools", "wrenches"]);
    checked = toggleTreeChecked(CATEGORIES, checked, "saws");
    expect([...checked].sort()).toEqual(["hammers", "wrenches"]);
    checked = toggleTreeChecked(CATEGORIES, checked, "saws");
    expect(checked.has("tools")).toBe(true);
    checked = toggleTreeChecked(CATEGORIES, checked, "tools");
    expect(checked.size).toBe(0);
    const electrical: TreeNode[] = [{ id: "electrical", label: "Electrical", children: [{ id: "wire", label: "Wire" }, { id: "breakers", label: "Breakers", disabled: true }] }];
    const partial = toggleTreeChecked(electrical, new Set(), "electrical");
    expect([...partial]).toEqual(["wire"]);
    expect(computeTreeCheckState(electrical, partial).get("electrical")).toBe("mixed");
    expect(toggleTreeChecked(electrical, partial, "missing")).toEqual(partial);
  });
});

describe("TreeView", () => {
  it("uses one tab stop and the APG tree keyboard", () => {
    render(<TreeView nodes={CATEGORIES} label="Categories" />);
    const tree = screen.getByRole("tree", { name: "Categories" });
    const rows = within(tree).getAllByRole("treeitem");
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.tabIndex === 0)).toEqual([rows[0]]);
    act(() => rows[0]!.focus());
    fireEvent.keyDown(item("Hand tools"), { key: "ArrowRight" });
    expect(item("Hand tools").getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(item("Hand tools"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(item("Hammers"));
    expect(item("Hammers").getAttribute("aria-level")).toBe("2");
    expect(item("Hammers").getAttribute("aria-posinset")).toBe("1");
    expect(item("Hammers").getAttribute("aria-setsize")).toBe("3");
    fireEvent.keyDown(item("Hammers"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("Saws"));
    expect(item("Saws").tabIndex).toBe(0);
    expect(item("Hammers").tabIndex).toBe(-1);
    fireEvent.keyDown(item("Saws"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(item("Hand tools"));
    fireEvent.keyDown(item("Hand tools"), { key: "ArrowLeft" });
    expect(item("Hand tools").getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(item("Hand tools"), { key: "End" });
    expect(document.activeElement).toBe(item("Paint"));
    fireEvent.keyDown(item("Paint"), { key: "Home" });
    expect(document.activeElement).toBe(item("Hand tools"));
    fireEvent.keyDown(item("Hand tools"), { key: "*" });
    expect(item("Hand tools").getAttribute("aria-expanded")).toBe("true");
    expect(item("Plumbing").getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(item("Hand tools"), { key: "p" });
    expect(document.activeElement).toBe(item("Plumbing"));
    fireEvent.keyDown(item("Plumbing"), { key: "a" });
    expect(document.activeElement).toBe(item("Paint"));
  });

  it("selects one node with Enter, Space or a click", () => {
    const onSelectedChange = vi.fn();
    render(<TreeView nodes={CATEGORIES} label="Categories" onSelectedChange={onSelectedChange} />);
    act(() => item("Paint").focus());
    fireEvent.keyDown(item("Paint"), { key: "Enter" });
    expect(onSelectedChange).toHaveBeenLastCalledWith(["paint"]);
    expect(item("Paint").getAttribute("aria-selected")).toBe("true");
    expect(item("Plumbing").getAttribute("aria-selected")).toBe("false");
    fireEvent.click(item("Plumbing"));
    expect(onSelectedChange).toHaveBeenLastCalledWith(["plumbing"]);
    expect(item("Paint").getAttribute("aria-selected")).toBe("false");
  });

  it("calls onAction on Enter", () => {
    const onAction = vi.fn();
    render(<TreeView nodes={CATEGORIES} label="Categories" selectionMode="none" onAction={onAction} />);
    act(() => item("Paint").focus());
    fireEvent.keyDown(item("Paint"), { key: "Enter" });
    expect(onAction).toHaveBeenCalledWith(CATEGORIES[2]);
    expect(item("Paint").hasAttribute("aria-selected")).toBe(false);
  });

  it("supports multiple selection with Space, Shift and Ctrl+A", () => {
    const onSelectedChange = vi.fn();
    render(<TreeView nodes={CATEGORIES} label="Categories" selectionMode="multiple" defaultExpanded={["tools"]} onSelectedChange={onSelectedChange} />);
    expect(screen.getByRole("tree").getAttribute("aria-multiselectable")).toBe("true");
    act(() => item("Hammers").focus());
    fireEvent.keyDown(item("Hammers"), { key: " " });
    fireEvent.keyDown(item("Hammers"), { key: "ArrowDown", shiftKey: true });
    expect(onSelectedChange).toHaveBeenLastCalledWith(["hammers", "saws"]);
    fireEvent.keyDown(item("Saws"), { key: " " });
    expect(onSelectedChange).toHaveBeenLastCalledWith(["hammers"]);
    fireEvent.keyDown(item("Saws"), { key: "a", ctrlKey: true });
    expect(onSelectedChange).toHaveBeenLastCalledWith(["tools", "hammers", "saws", "wrenches", "plumbing", "paint"]);
    fireEvent.click(item("Paint"));
    expect(item("Paint").getAttribute("aria-selected")).toBe("false");
  });

  it("cascades tri-state checkboxes", () => {
    const onCheckedChange = vi.fn();
    render(<TreeView nodes={CATEGORIES} label="Categories" selectionMode="none" checkboxes defaultExpanded={["tools"]} onCheckedChange={onCheckedChange} />);
    expect(item("Hand tools").getAttribute("aria-checked")).toBe("false");
    act(() => item("Hand tools").focus());
    fireEvent.keyDown(item("Hand tools"), { key: " " });
    expect([...(onCheckedChange.mock.lastCall?.[0] as string[])].sort()).toEqual(["hammers", "saws", "tools", "wrenches"]);
    expect(item("Saws").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(item("Saws"));
    expect(item("Saws").getAttribute("aria-checked")).toBe("false");
    expect(item("Hand tools").getAttribute("aria-checked")).toBe("mixed");
  });

  it("loads children on expand, shows a retry row on failure and retries", async () => {
    const loadChildren = vi
      .fn<(node: TreeNode) => Promise<TreeNode[]>>()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce([{ id: "nails", label: "Nails" }]);
    render(<TreeView nodes={[{ id: "fasteners", label: "Fasteners", hasChildren: true }]} label="Catalog" loadChildren={loadChildren} />);
    act(() => item("Fasteners").focus());
    fireEvent.keyDown(item("Fasteners"), { key: "ArrowRight" });
    expect(item("Fasteners").getAttribute("aria-expanded")).toBe("true");
    expect(item("Fasteners").getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector('[data-slot="tree-view-loading"]')).not.toBeNull();
    await act(async () => undefined);
    const retry = item("Could not load Fasteners. Retry");
    expect(retry.getAttribute("aria-level")).toBe("2");
    fireEvent.keyDown(item("Fasteners"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(retry);
    fireEvent.keyDown(retry, { key: "Enter" });
    await act(async () => undefined);
    expect(item("Nails").getAttribute("aria-level")).toBe("2");
    expect(loadChildren).toHaveBeenCalledTimes(2);
    expect(loadChildren).toHaveBeenCalledWith({ id: "fasteners", label: "Fasteners", hasChildren: true });
  });

  it("keeps expansion controlled and shows an empty label", () => {
    const onExpandedChange = vi.fn();
    const { unmount } = render(<TreeView nodes={CATEGORIES} label="Categories" expanded={[]} onExpandedChange={onExpandedChange} />);
    act(() => item("Hand tools").focus());
    fireEvent.keyDown(item("Hand tools"), { key: "ArrowRight" });
    expect(onExpandedChange).toHaveBeenCalledWith(["tools"]);
    expect(item("Hand tools").getAttribute("aria-expanded")).toBe("false");
    unmount();
    render(<TreeView nodes={[]} label="Empty" emptyLabel="No categories yet" />);
    expect(screen.getByText("No categories yet")).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* DescriptionList                                                     */
/* ------------------------------------------------------------------ */

describe("DescriptionList", () => {
  const STORE = [
    { term: "Address", details: "1200 Main Street, Springfield" },
    { term: "Phone", details: "(555) 010-4477", copyValue: "(555) 010-4477" },
    { term: "Email", details: "service@example.com", copyValue: "service@example.com", copyLabel: "Copy store email" },
  ];

  it("renders semantic term and detail pairs in each layout", () => {
    const { container, rerender } = render(<DescriptionList items={STORE} />);
    const list = container.querySelector("dl")!;
    expect(list.getAttribute("data-layout")).toBe("inline");
    expect(list.querySelectorAll("dt")).toHaveLength(3);
    expect(list.querySelectorAll("dd")).toHaveLength(3);
    expect(list.querySelector("dt")!.textContent).toBe("Address");
    rerender(<DescriptionList items={STORE} layout="grid" columns={3} />);
    expect(container.querySelector("dl")!.className).toContain("lg:grid-cols-3");
    rerender(<DescriptionList items={STORE} layout="stacked" dividers={false} />);
    expect(container.querySelector("dl")!.className).not.toContain("divide-y");
  });

  it("copies values and confirms politely", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<DescriptionList items={STORE} />);
    expect(screen.queryByRole("button", { name: "Copy Address" })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Phone" }));
    });
    expect(writeText).toHaveBeenCalledWith("(555) 010-4477");
    expect(screen.getAllByRole("status").some((status) => status.textContent === "Copied")).toBe(true);
    expect(screen.getByRole("button", { name: "Copy store email" })).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* Countdown and Timer                                                 */
/* ------------------------------------------------------------------ */

describe("splitDuration", () => {
  it("splits into units and folds above the largest unit", () => {
    expect(splitDuration(93_784_005)).toEqual({ days: 1, hours: 2, minutes: 3, seconds: 4, milliseconds: 5, total: 93_784_005 });
    expect(splitDuration(93_784_005, "hours")).toMatchObject({ days: 0, hours: 26, minutes: 3, seconds: 4 });
    expect(splitDuration(93_784_005, "minutes")).toMatchObject({ hours: 0, minutes: 1563, seconds: 4 });
    expect(splitDuration(93_784_005, "seconds")).toMatchObject({ minutes: 0, seconds: 93_784, milliseconds: 5 });
    expect(splitDuration(1500.7)).toMatchObject({ seconds: 1, milliseconds: 500, total: 1500 });
  });

  it("treats negative and non-finite input as zero", () => {
    const zero = { days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, total: 0 };
    expect(splitDuration(-5000)).toEqual(zero);
    expect(splitDuration(Number.NaN)).toEqual(zero);
    expect(splitDuration(Number.POSITIVE_INFINITY)).toEqual(zero);
  });
});

describe("Countdown", () => {
  const NOW = new Date(2026, 9, 25, 9, 0, 0).getTime();
  const TARGET = new Date(2026, 9, 26, 11, 3, 30);

  it("ticks every second but announces at most once a minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { container } = render(<Countdown target={TARGET} label="Spring sale ends in" />);
    const group = screen.getByRole("group", { name: "Spring sale ends in" });
    const digits = () => [...group.querySelectorAll('[aria-hidden="true"] .text-2xl')].map((element) => element.textContent);
    expect(digits()).toEqual(["01", "02", "03", "30"]);
    const live = container.querySelector("[aria-live]")!;
    expect(live.textContent).toBe("1 day, 2 hours and 3 minutes remaining");
    act(() => vi.advanceTimersByTime(10_000));
    expect(digits()).toEqual(["01", "02", "03", "20"]);
    expect(live.textContent).toBe("1 day, 2 hours and 3 minutes remaining");
    act(() => vi.advanceTimersByTime(21_000));
    expect(live.textContent).toBe("1 day, 2 hours and 2 minutes remaining");
  });

  it("renders compact text and folds days into hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { rerender } = render(<Countdown target={TARGET} label="Ends in" variant="compact" />);
    expect(screen.getByRole("group", { name: "Ends in" }).textContent).toContain("01d 02h 03m 30s");
    rerender(<Countdown target={TARGET} label="Ends in" variant="compact" largestUnit="hours" />);
    expect(screen.getByRole("group", { name: "Ends in" }).textContent).toContain("26h 03m 30s");
  });

  it("calls onComplete once and shows the completed label", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const onComplete = vi.fn();
    render(<Countdown target={NOW + 2000} label="Doorbuster ends in" onComplete={onComplete} completedLabel="Doorbuster has ended" />);
    expect(screen.getByRole("group").textContent).not.toContain("days");
    act(() => vi.advanceTimersByTime(2500));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Doorbuster has ended").length).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(5000));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders a stable value on the server", () => {
    const html = renderToString(<Countdown target={TARGET} label="Sale ends in" serverNow={NOW} variant="compact" />);
    expect(html).toContain("01d 02h 03m 30s");
    expect(html).toContain("1 day, 2 hours and 3 minutes remaining");
    const placeholder = renderToString(<Countdown target={TARGET} label="Sale ends in" variant="compact" />);
    expect(placeholder).toContain("--h --m --s");
    expect(placeholder).not.toContain("remaining");
  });
});

describe("Timer", () => {
  it("runs a stopwatch with start, pause, resume and reset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 9, 0, 0));
    const onPause = vi.fn();
    const { container } = render(<Timer label="Stopwatch" onPause={onPause} />);
    const clock = screen.getByRole("timer");
    const live = container.querySelector("[aria-live]")!;
    expect(clock.textContent).toBe("00:00");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(live.textContent).toBe("Stopwatch started");
    act(() => vi.advanceTimersByTime(65_000));
    expect(clock.textContent).toBe("01:05");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalledWith(65_000);
    expect(live.textContent).toBe("Stopwatch paused at 1 minute and 5 seconds");
    act(() => vi.advanceTimersByTime(10_000));
    expect(clock.textContent).toBe("01:05");
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    act(() => vi.advanceTimersByTime(5_000));
    expect(clock.textContent).toBe("01:10");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(clock.textContent).toBe("00:00");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Start" }));
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });

  it("counts down from a duration and completes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 9, 0, 0));
    const onComplete = vi.fn();
    const { container } = render(<Timer label="Paint timer" mode="countdown" duration={3000} onComplete={onComplete} />);
    const clock = screen.getByRole("timer");
    expect(clock.textContent).toBe("00:03");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    act(() => vi.advanceTimersByTime(1200));
    expect(clock.textContent).toBe("00:02");
    act(() => vi.advanceTimersByTime(2000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(clock.textContent).toBe("00:00");
    expect(container.querySelector("[aria-live]")!.textContent).toBe("Paint timer: time is up");
    expect(screen.getByRole("button", { name: "Start again" })).toBeTruthy();
  });

  it("disables a zero-length countdown", () => {
    render(<Timer label="Empty timer" mode="countdown" duration={0} />);
    expect((screen.getByRole("button", { name: "Start" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* VirtualList                                                         */
/* ------------------------------------------------------------------ */

describe("computeVirtualRange", () => {
  it("computes fixed-height windows with overscan", () => {
    expect(computeVirtualRange({ count: 10_000, scrollTop: 0, viewportHeight: 200, itemHeight: 20, overscan: 2 })).toEqual({ start: 0, end: 12, visibleStart: 0, visibleEnd: 10, totalHeight: 200_000 });
    expect(computeVirtualRange({ count: 10_000, scrollTop: 1010, viewportHeight: 200, itemHeight: 20, overscan: 2 })).toEqual({ start: 48, end: 63, visibleStart: 50, visibleEnd: 61, totalHeight: 200_000 });
  });

  it("clamps scroll positions outside the content", () => {
    expect(computeVirtualRange({ count: 10_000, scrollTop: 9_999_999, viewportHeight: 200, itemHeight: 20, overscan: 2 })).toEqual({ start: 9988, end: 10_000, visibleStart: 9990, visibleEnd: 10_000, totalHeight: 200_000 });
    expect(computeVirtualRange({ count: 100, scrollTop: -50, viewportHeight: 100, itemHeight: 20 })).toMatchObject({ start: 0, visibleStart: 0, visibleEnd: 5, end: 5 });
    expect(computeVirtualRange({ count: 3, scrollTop: 500, viewportHeight: 400, itemHeight: 20, overscan: 5 })).toEqual({ start: 0, end: 3, visibleStart: 0, visibleEnd: 3, totalHeight: 60 });
  });

  it("handles empty lists, zero viewports and invalid options", () => {
    expect(computeVirtualRange({ count: 0, scrollTop: 0, viewportHeight: 200, itemHeight: 20 })).toEqual({ start: 0, end: 0, visibleStart: 0, visibleEnd: 0, totalHeight: 0 });
    expect(computeVirtualRange({ count: 50, scrollTop: 40, viewportHeight: 0, itemHeight: 20, overscan: 1 })).toEqual({ start: 1, end: 4, visibleStart: 2, visibleEnd: 3, totalHeight: 1000 });
    expect(computeVirtualRange({ count: 50, scrollTop: 0, viewportHeight: 100, itemHeight: 0 })).toEqual({ start: 0, end: 0, visibleStart: 0, visibleEnd: 0, totalHeight: 0 });
    expect(computeVirtualRange({ count: 10.8, scrollTop: 0, viewportHeight: 40, itemHeight: 20, overscan: -3 })).toEqual({ start: 0, end: 2, visibleStart: 0, visibleEnd: 2, totalHeight: 200 });
  });

  it("binary-searches variable heights from offsets", () => {
    const offsets = [0, 10, 40, 60, 100, 150];
    expect(computeVirtualRange({ count: 5, scrollTop: 35, viewportHeight: 30, offsets, overscan: 1 })).toEqual({ start: 0, end: 5, visibleStart: 1, visibleEnd: 4, totalHeight: 150 });
    expect(computeVirtualRange({ count: 5, scrollTop: 40, viewportHeight: 0, offsets })).toMatchObject({ visibleStart: 2, visibleEnd: 3 });
    expect(computeVirtualRange({ count: 5, scrollTop: 60, viewportHeight: 40, offsets })).toMatchObject({ visibleStart: 3, visibleEnd: 4 });
    expect(computeVirtualRange({ count: 5, scrollTop: 1000, viewportHeight: 40, offsets })).toMatchObject({ visibleStart: 4, visibleEnd: 5, end: 5 });
  });
});

const SKUS = Array.from({ length: 10_000 }, (_, index) => `SKU-${String(index).padStart(5, "0")}`);

describe("VirtualList", () => {
  it("renders only the visible window with full set size", () => {
    render(<VirtualList items={SKUS} label="SKUs" height={200} itemHeight={20} overscan={2} renderItem={(sku) => <span>{sku}</span>} />);
    const list = screen.getByRole("list", { name: "SKUs" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(12);
    expect(rows[0]!.getAttribute("aria-setsize")).toBe("10000");
    expect(rows[0]!.getAttribute("aria-posinset")).toBe("1");
    expect(list.tabIndex).toBe(0);
    list.scrollTop = 1000;
    fireEvent.scroll(list);
    const scrolled = within(list).getAllByRole("listitem");
    expect(scrolled[0]!.getAttribute("aria-posinset")).toBe("49");
    expect(scrolled[0]!.textContent).toBe("SKU-00048");
  });

  it("scrolls to an index through the ref handle", () => {
    const ref = createRef<VirtualListHandle>();
    render(<VirtualList ref={ref} items={SKUS} label="SKUs" height={200} itemHeight={20} overscan={2} renderItem={(sku) => sku} />);
    const list = screen.getByRole("list", { name: "SKUs" });
    act(() => ref.current!.scrollToIndex(5000, "start"));
    expect(list.scrollTop).toBe(100_000);
    expect(screen.getByText("SKU-05000").closest("[aria-posinset]")!.getAttribute("aria-posinset")).toBe("5001");
    act(() => ref.current!.scrollToIndex(100, "center"));
    expect(list.scrollTop).toBe(1910);
    act(() => ref.current!.scrollToIndex(104));
    expect(list.scrollTop).toBe(1910);
    act(() => ref.current!.scrollToIndex(105));
    expect(list.scrollTop).toBe(1920);
    act(() => ref.current!.scrollToIndex(200, "end"));
    expect(list.scrollTop).toBe(3820);
    act(() => ref.current!.scrollToIndex(99_999));
    expect(list.scrollTop).toBe(199_800);
  });

  it("works as a keyboard listbox with an active descendant", () => {
    const onSelect = vi.fn();
    render(<VirtualList items={SKUS} label="SKU picker" mode="listbox" height={200} itemHeight={20} overscan={2} onSelect={onSelect} renderItem={(sku) => sku} />);
    const listbox = screen.getByRole("listbox", { name: "SKU picker" });
    act(() => listbox.focus());
    const active = () => document.getElementById(listbox.getAttribute("aria-activedescendant") ?? "");
    expect(active()?.textContent).toBe("SKU-00000");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    expect(active()?.textContent).toBe("SKU-00001");
    expect(active()?.getAttribute("role")).toBe("option");
    fireEvent.keyDown(listbox, { key: "End" });
    expect(active()?.textContent).toBe("SKU-09999");
    expect(active()?.getAttribute("aria-posinset")).toBe("10000");
    fireEvent.keyDown(listbox, { key: "PageUp" });
    expect(active()?.textContent).toBe("SKU-09990");
    fireEvent.keyDown(listbox, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("SKU-09990", 9990);
    fireEvent.keyDown(listbox, { key: "Home" });
    fireEvent.click(screen.getByText("SKU-00003"));
    expect(onSelect).toHaveBeenLastCalledWith("SKU-00003", 3);
    expect(active()?.textContent).toBe("SKU-00003");
  });

  it("positions estimated rows and shows an empty state", () => {
    const { unmount } = render(<VirtualList items={SKUS.slice(0, 50)} label="Variable" height={120} estimateHeight={30} overscan={1} renderItem={(sku) => sku} />);
    const rows = within(screen.getByRole("list", { name: "Variable" })).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows[1]!.style.transform).toBe("translateY(30px)");
    unmount();
    render(<VirtualList items={[]} label="Nothing" height={120} itemHeight={20} emptyLabel="No SKUs match" renderItem={(sku: string) => sku} />);
    expect(within(screen.getByRole("list", { name: "Nothing" })).getByRole("listitem").textContent).toBe("No SKUs match");
  });
});

/* ------------------------------------------------------------------ */
/* InfiniteScroll                                                      */
/* ------------------------------------------------------------------ */

describe("InfiniteScroll", () => {
  it("loads from the fallback button and blocks duplicate calls while pending", async () => {
    let resolve: () => void = () => undefined;
    const onLoadMore = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(
      <InfiniteScroll onLoadMore={onLoadMore} hasMore loadMoreLabel="Load more orders">
        <p>Order 1001</p>
      </InfiniteScroll>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more orders" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole("button", { name: "Loading more" });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(busy);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("Loading more");
    await act(async () => resolve());
    expect(screen.getByRole("button", { name: "Load more orders" }).hasAttribute("aria-disabled")).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows an error with retry", async () => {
    const onLoadMore = vi.fn().mockRejectedValueOnce(new Error("Server unavailable")).mockResolvedValueOnce(undefined);
    render(
      <InfiniteScroll onLoadMore={onLoadMore} hasMore>
        <p>Order 1001</p>
      </InfiniteScroll>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not load more");
    expect(alert.textContent).toContain("Server unavailable");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the end message and moves focus to it from the button", async () => {
    function Feed() {
      const [orders, setOrders] = useState(["Order 1001"]);
      return (
        <InfiniteScroll hasMore={orders.length < 2} endMessage="No older orders." onLoadMore={async () => setOrders((previous) => [...previous, "Order 1000"])}>
          {orders.map((order) => (
            <p key={order}>{order}</p>
          ))}
        </InfiniteScroll>
      );
    }
    render(<Feed />);
    const button = screen.getByRole("button", { name: "Load more" });
    act(() => button.focus());
    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByText("Order 1000")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(document.activeElement?.textContent).toBe("No older orders.");
  });

  it("loads when the sentinel intersects and re-observes after each page", async () => {
    const observers: Array<{ callback: IntersectionObserverCallback; disconnected: boolean }> = [];
    class FakeObserver {
      record: { callback: IntersectionObserverCallback; disconnected: boolean };
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, disconnected: false };
        observers.push(this.record);
      }
      observe() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      disconnect() {
        this.record.disconnected = true;
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    let resolve: () => void = () => undefined;
    const onLoadMore = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    render(
      <InfiniteScroll onLoadMore={onLoadMore} hasMore>
        <p>Order 1001</p>
      </InfiniteScroll>,
    );
    const first = observers[observers.length - 1]!;
    const entry = { isIntersecting: true } as IntersectionObserverEntry;
    act(() => {
      first.callback([entry], {} as IntersectionObserver);
      first.callback([entry], {} as IntersectionObserver);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(first.disconnected).toBe(true);
    const count = observers.length;
    await act(async () => resolve());
    expect(observers.length).toBe(count + 1);
    expect(observers[observers.length - 1]!.disconnected).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Masonry                                                             */
/* ------------------------------------------------------------------ */

describe("Masonry", () => {
  it("derives the column count from the width", () => {
    expect(masonryColumnCount(0, 240, 16)).toBe(1);
    expect(masonryColumnCount(1000, 240, 16)).toBe(3);
    expect(masonryColumnCount(1000, 240, 16, 2)).toBe(2);
    expect(masonryColumnCount(100, 240, 16)).toBe(1);
    expect(masonryColumnCount(500, 0)).toBe(1);
  });

  it("places items in the shortest column in order", () => {
    expect(computeMasonryLayout([100, 50, 80, 30], 2, 10)).toEqual({
      placements: [
        { column: 0, top: 0 },
        { column: 1, top: 0 },
        { column: 1, top: 60 },
        { column: 0, top: 110 },
      ],
      height: 140,
    });
    expect(computeMasonryLayout([], 3, 10)).toEqual({ placements: [], height: 0 });
    expect(computeMasonryLayout([40, 40], 0)).toMatchObject({ height: 80 });
  });

  it("renders a single column in source order before layout", () => {
    const ideas = ["Floating shelves", "Raised garden bed", "Pegboard tool wall"];
    const { container } = render(<Masonry items={ideas} getKey={(idea) => idea} renderItem={(idea) => <article>{idea}</article>} />);
    const root = container.querySelector('[data-slot="masonry"]')!;
    expect(root.getAttribute("data-columns")).toBe("1");
    expect([...root.querySelectorAll("article")].map((element) => element.textContent)).toEqual(ideas);
    const html = renderToString(
      <Masonry>
        <p key="a">Porch swing</p>
        <p key="b">Window box</p>
      </Masonry>,
    );
    expect(html).toContain('data-columns="1"');
    expect(html.indexOf("Porch swing")).toBeLessThan(html.indexOf("Window box"));
  });
});

/* ------------------------------------------------------------------ */
/* Marquee                                                             */
/* ------------------------------------------------------------------ */

describe("Marquee", () => {
  it("hides repeated copies from assistive technology and pauses on request", () => {
    const onPausedChange = vi.fn();
    const { container } = render(
      <Marquee label="Supplier logos" onPausedChange={onPausedChange}>
        <span>Acme Fasteners</span>
        <span>Northwind Lumber</span>
      </Marquee>,
    );
    expect(screen.getByRole("group", { name: "Supplier logos" })).toBeTruthy();
    expect(screen.getAllByText("Acme Fasteners")).toHaveLength(2);
    const copy = container.querySelector('[data-slot="marquee-copy"]')!;
    expect(copy.getAttribute("aria-hidden")).toBe("true");
    expect(copy.hasAttribute("inert")).toBe(true);
    expect(container.querySelector('[data-slot="marquee-content"]')!.hasAttribute("aria-hidden")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Pause Supplier logos" }));
    expect(onPausedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Play Supplier logos" })).toBeTruthy();
  });

  it("shows a static wrapped list under reduced motion", () => {
    stubReducedMotion(true);
    const { container } = render(
      <Marquee label="Supplier logos">
        <span>Acme Fasteners</span>
      </Marquee>,
    );
    expect(container.querySelector('[data-slot="marquee"]')!.hasAttribute("data-static")).toBe(true);
    expect(screen.getAllByText("Acme Fasteners")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* TransferList                                                        */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = [
  { id: "lumber", label: "Lumber" },
  { id: "paint", label: "Paint" },
  { id: "plumbing", label: "Plumbing" },
  { id: "electrical", label: "Electrical" },
  { id: "garden", label: "Garden center", disabled: true },
];

describe("TransferList", () => {
  it("moves selected and all items between labelled listboxes", () => {
    const onValueChange = vi.fn();
    render(<TransferList items={DEPARTMENTS} targetLabel="Assigned" onValueChange={onValueChange} />);
    const source = screen.getByRole("listbox", { name: "Available" });
    const target = screen.getByRole("listbox", { name: "Assigned" });
    expect(source.getAttribute("aria-multiselectable")).toBe("true");
    const moveSelected = screen.getByRole("button", { name: "Move selected to Assigned" });
    expect(moveSelected.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(moveSelected);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(within(source).getByRole("option", { name: "Paint" }));
    expect(within(source).getByRole("option", { name: "Paint" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("1 of 5 selected")).toBeTruthy();
    fireEvent.click(moveSelected);
    expect(onValueChange).toHaveBeenLastCalledWith(["paint"]);
    expect(within(target).getByRole("option", { name: "Paint" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move all to Assigned" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["paint", "lumber", "plumbing", "electrical"]);
    expect(within(source).getAllByRole("option").map((option) => option.textContent)).toEqual(["Garden center"]);
    fireEvent.click(screen.getByRole("button", { name: "Move all to Available" }));
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it("filters each list and moves only visible items", () => {
    const onValueChange = vi.fn();
    render(<TransferList items={DEPARTMENTS} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter Available" }), { target: { value: "pl" } });
    const source = screen.getByRole("listbox", { name: "Available" });
    expect(within(source).getAllByRole("option").map((option) => option.textContent)).toEqual(["Plumbing"]);
    fireEvent.click(screen.getByRole("button", { name: "Move all to Selected" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["plumbing"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter Available" }), { target: { value: "zzz" } });
    expect(within(source).getByRole("option").textContent).toBe("No matches");
  });

  it("supports keyboard selection and Enter to move", () => {
    const onValueChange = vi.fn();
    render(<TransferList items={DEPARTMENTS} onValueChange={onValueChange} />);
    const source = screen.getByRole("listbox", { name: "Available" });
    act(() => source.focus());
    const active = () => document.getElementById(source.getAttribute("aria-activedescendant") ?? "");
    expect(active()?.textContent).toBe("Lumber");
    fireEvent.keyDown(source, { key: "ArrowDown" });
    expect(active()?.textContent).toBe("Paint");
    fireEvent.keyDown(source, { key: " " });
    fireEvent.keyDown(source, { key: "ArrowDown", shiftKey: true });
    expect(within(source).getAllByRole("option", { selected: true }).map((option) => option.textContent)).toEqual(["Paint", "Plumbing"]);
    fireEvent.keyDown(source, { key: "a", ctrlKey: true });
    expect(within(source).getAllByRole("option", { selected: true })).toHaveLength(4);
    fireEvent.keyDown(source, { key: "End" });
    expect(active()?.textContent).toBe("Electrical");
    fireEvent.keyDown(source, { key: "Enter" });
    expect(onValueChange).toHaveBeenLastCalledWith(["electrical"]);
  });

  it("stays controlled", () => {
    const onValueChange = vi.fn();
    render(<TransferList items={DEPARTMENTS} value={["lumber"]} onValueChange={onValueChange} />);
    const target = screen.getByRole("listbox", { name: "Selected" });
    fireEvent.click(within(target).getByRole("option", { name: "Lumber" }));
    fireEvent.click(screen.getByRole("button", { name: "Move selected to Available" }));
    expect(onValueChange).toHaveBeenCalledWith([]);
    expect(within(target).getByRole("option", { name: "Lumber" })).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* SortableList                                                        */
/* ------------------------------------------------------------------ */

const PICKS = ["Tape measure", "Claw hammer", "Wood screws", "Drill bits", "Safety glasses", "Work gloves"].map((name, index) => ({ id: `pick-${index}`, name }));

function PickList(props: { onReorder?: (items: typeof PICKS) => void; disabled?: boolean }) {
  return <SortableList label="Pick list" defaultItems={PICKS} getKey={(pick) => pick.id} getLabel={(pick) => pick.name} renderItem={(pick) => <span data-name="">{pick.name}</span>} {...props} />;
}

const names = () => [...document.querySelectorAll("[data-name]")].map((element) => element.textContent);

describe("moveItem", () => {
  it("moves forward and backward without mutating", () => {
    const source = ["a", "b", "c", "d"];
    expect(moveItem(source, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(source, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(source, 1, 1)).toEqual(source);
    expect(source).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps the target and ignores an invalid source", () => {
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
    const copy = moveItem(["a", "b"], 5, 0);
    expect(copy).toEqual(["a", "b"]);
    expect(moveItem([], 0, 0)).toEqual([]);
    expect(moveItem(["a", "b"], 0.5, 1)).toEqual(["a", "b"]);
  });
});

describe("SortableList", () => {
  it("picks up, moves and drops with the keyboard and announces assertively", () => {
    const onReorder = vi.fn();
    const { container } = render(<PickList onReorder={onReorder} />);
    const live = container.querySelector('[aria-live="assertive"]')!;
    const handle = screen.getByRole("button", { name: "Reorder Claw hammer" });
    expect(handle.getAttribute("aria-describedby")).toBeTruthy();
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: " " });
    expect(live.textContent).toContain("Picked up Claw hammer, position 2 of 6.");
    expect(handle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(live.textContent).toBe("Claw hammer is now at position 3 of 6.");
    expect(names()).toEqual(["Tape measure", "Wood screws", "Claw hammer", "Drill bits", "Safety glasses", "Work gloves"]);
    expect(onReorder).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Claw hammer" }), { key: "Enter" });
    expect(live.textContent).toBe("Moved Claw hammer to position 3 of 6.");
    expect((onReorder.mock.lastCall?.[0] as typeof PICKS).map((pick) => pick.name)).toEqual(["Tape measure", "Wood screws", "Claw hammer", "Drill bits", "Safety glasses", "Work gloves"]);
  });

  it("cancels with Escape and restores the order", () => {
    const onReorder = vi.fn();
    const { container } = render(<PickList onReorder={onReorder} />);
    const live = container.querySelector('[aria-live="assertive"]')!;
    const handle = screen.getByRole("button", { name: "Reorder Claw hammer" });
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyDown(handle, { key: "End" });
    expect(names()[5]).toBe("Claw hammer");
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Claw hammer" }), { key: "Escape" });
    expect(names()).toEqual(PICKS.map((pick) => pick.name));
    expect(live.textContent).toBe("Reorder cancelled. Claw hammer returned to position 2 of 6.");
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("reorders by dragging a handle", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0;
      return new DOMRect(0, index * 40, 300, 40);
    });
    const onReorder = vi.fn();
    render(<PickList onReorder={onReorder} />);
    const handle = screen.getByRole("button", { name: "Reorder Tape measure" });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 7, clientY: 20 });
    fireEvent.pointerMove(handle, { pointerId: 7, clientY: 101 });
    expect(names()).toEqual(["Claw hammer", "Wood screws", "Tape measure", "Drill bits", "Safety glasses", "Work gloves"]);
    fireEvent.pointerUp(handle, { pointerId: 7, clientY: 101 });
    expect((onReorder.mock.lastCall?.[0] as typeof PICKS).map((pick) => pick.name).slice(0, 3)).toEqual(["Claw hammer", "Wood screws", "Tape measure"]);
  });

  it("disables every handle", () => {
    render(<PickList disabled />);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* CircularProgress                                                    */
/* ------------------------------------------------------------------ */

describe("CircularProgress", () => {
  it("exposes a determinate progressbar with a centered value", () => {
    const { container } = render(<CircularProgress value={40} label="Cycle count" tone="success" />);
    const bar = screen.getByRole("progressbar", { name: "Cycle count" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuetext")).toBe("40%");
    expect(bar.hasAttribute("aria-busy")).toBe(false);
    expect(bar.textContent).toContain("40%");
    expect(container.querySelectorAll("circle")[1]!.getAttribute("stroke")).toBe("var(--success)");
  });

  it("clamps and formats custom values", () => {
    render(<CircularProgress value={150} max={120} label="Bins counted" formatValue={(value) => `${value} of 120 bins`} />);
    const bar = screen.getByRole("progressbar", { name: "Bins counted" });
    expect(bar.getAttribute("aria-valuenow")).toBe("120");
    expect(bar.getAttribute("aria-valuetext")).toBe("120 of 120 bins");
  });

  it("shows an indeterminate busy spinner", () => {
    const { container } = render(<CircularProgress label="Syncing inventory" size="sm" />);
    const bar = screen.getByRole("progressbar", { name: "Syncing inventory" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.getAttribute("aria-busy")).toBe("true");
    expect(bar.getAttribute("aria-valuetext")).toBe("Loading");
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("motion-safe:animate-spin");
    expect(bar.querySelector("span[aria-hidden]")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* CalendarHeatmap                                                     */
/* ------------------------------------------------------------------ */

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

function withTimeZone(zone: string, run: () => void) {
  const previous = env.TZ;
  env.TZ = zone;
  try {
    run();
  } finally {
    if (previous === undefined) delete env.TZ;
    else env.TZ = previous;
  }
}

function utcKeys(year: number, month: number, day: number, length: number): string[] {
  return Array.from({ length }, (_, index) => new Date(Date.UTC(year, month, day + index)).toISOString().slice(0, 10));
}

describe("heatmap helpers", () => {
  it("levels values against the busiest day", () => {
    expect(heatmapLevel(0, 10)).toBe(0);
    expect(heatmapLevel(-3, 10)).toBe(0);
    expect(heatmapLevel(5, 0)).toBe(0);
    expect(heatmapLevel(1, 10)).toBe(1);
    expect(heatmapLevel(5, 10)).toBe(2);
    expect(heatmapLevel(7.6, 10)).toBe(4);
    expect(heatmapLevel(10, 10)).toBe(4);
    expect(heatmapColor(0)).toBe("color-mix(in oklab, var(--chart-1) 8%, var(--background))");
    expect(heatmapColor(4)).toContain("var(--chart-1) 100%");
  });

  it("builds week columns, sums values and pads to whole weeks", () => {
    const matrix = buildHeatmapMatrix("2026-03-01", "2026-03-14", [
      { date: "2026-03-03", value: 10 },
      { date: "2026-03-03", value: 4 },
      { date: new Date(2026, 2, 5, 15, 30), value: 7 },
      { date: "2026-02-20", value: 99 },
    ]);
    expect(matrix.weeks).toHaveLength(2);
    expect(matrix.days).toHaveLength(14);
    expect(matrix.max).toBe(14);
    expect(matrix.weeks[0]![2]).toMatchObject({ key: "2026-03-03", value: 14, level: 4, row: 2, week: 0 });
    expect(matrix.weeks[0]![4]).toMatchObject({ key: "2026-03-05", value: 7, level: 2 });
    expect(matrix.weeks[1]![0]).toMatchObject({ key: "2026-03-08", value: 0, level: 0 });
    expect(matrix.months).toEqual([{ week: 0, month: 2, year: 2026 }]);
    const monday = buildHeatmapMatrix("2026-03-01", "2026-03-03", [], 1);
    expect(monday.weeks[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(monday.weeks[0]![6]).toMatchObject({ key: "2026-03-01", row: 6 });
    expect(monday.weeks[1]![0]).toMatchObject({ key: "2026-03-02" });
    expect(buildHeatmapMatrix("2026-03-14", "2026-03-01").days).toHaveLength(14);
  });

  it("crosses a year boundary without gaps and labels the new month", () => {
    const matrix = buildHeatmapMatrix("2025-12-25", "2026-01-10");
    expect(matrix.days.map((day) => day.key)).toEqual(utcKeys(2025, 11, 25, 17));
    expect(matrix.weeks[0]!.slice(0, 4)).toEqual([null, null, null, null]);
    expect(matrix.months).toEqual([{ week: 1, month: 0, year: 2026 }]);
    const long = buildHeatmapMatrix("2025-11-01", "2026-02-28");
    expect(long.months.map((month) => `${month.year}-${month.month}`)).toEqual(["2025-10", "2025-11", "2026-0", "2026-1"]);
  });

  it("steps by calendar day across daylight saving changes", () => {
    withTimeZone("America/New_York", () => {
      expect(new Date(2026, 2, 7, 12).getTimezoneOffset()).not.toBe(new Date(2026, 2, 9, 12).getTimezoneOffset());
      const spring = buildHeatmapMatrix("2026-03-01", "2026-03-15", [{ date: "2026-03-08", value: 3 }]);
      expect(spring.days.map((day) => day.key)).toEqual(utcKeys(2026, 2, 1, 15));
      expect(spring.days.every((day) => day.date.getHours() === 0)).toBe(true);
      expect(spring.days.find((day) => day.key === "2026-03-08")?.value).toBe(3);
      const fall = buildHeatmapMatrix("2026-10-25", "2026-11-08");
      expect(fall.days.map((day) => day.key)).toEqual(utcKeys(2026, 9, 25, 15));
    });
    withTimeZone("America/Santiago", () => {
      const chile = buildHeatmapMatrix("2026-09-01", "2026-09-12");
      expect(chile.days.map((day) => day.key)).toEqual(utcKeys(2026, 8, 1, 12));
    });
  });
});

describe("CalendarHeatmap", () => {
  const SALES = [
    { date: "2026-03-03", value: 14 },
    { date: "2026-03-04", value: 1 },
    { date: "2026-03-20", value: 9 },
  ];

  it("renders a labelled grid with weekday row headers and day labels", () => {
    render(<CalendarHeatmap values={SALES} start="2026-03-01" end="2026-03-31" label="Daily sales" unit={["sale", "sales"]} />);
    const grid = screen.getByRole("grid", { name: "Daily sales" });
    expect(within(grid).getAllByRole("row")).toHaveLength(7);
    expect(within(grid).getAllByRole("rowheader").map((header) => header.textContent)).toContain("MonMonday");
    expect(screen.getByRole("gridcell", { name: "14 sales on Tuesday, March 3, 2026" }).getAttribute("data-level")).toBe("4");
    expect(screen.getByRole("gridcell", { name: "1 sale on Wednesday, March 4, 2026" })).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "No sales on Sunday, March 1, 2026" }).getAttribute("data-level")).toBe("0");
    const tabbable = within(grid)
      .getAllByRole("gridcell")
      .filter((cell) => cell.tabIndex === 0);
    expect(tabbable.map((cell) => cell.getAttribute("data-date"))).toEqual(["2026-03-31"]);
    expect(screen.getByText("Less")).toBeTruthy();
  });

  it("moves between days with the arrow keys, Home, End and Ctrl", () => {
    render(<CalendarHeatmap values={SALES} start="2026-03-01" end="2026-03-31" label="Daily sales" unit={["sale", "sales"]} />);
    const cell = (date: string) => document.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
    const press = (key: string, options: { ctrlKey?: boolean } = {}) => fireEvent.keyDown(document.activeElement!, { key, ...options });
    act(() => cell("2026-03-03").focus());
    press("ArrowRight");
    expect(document.activeElement).toBe(cell("2026-03-10"));
    expect(cell("2026-03-10").tabIndex).toBe(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(cell("2026-03-11"));
    press("ArrowUp");
    press("ArrowLeft");
    expect(document.activeElement).toBe(cell("2026-03-03"));
    press("End");
    expect(document.activeElement).toBe(cell("2026-03-31"));
    press("Home");
    expect(document.activeElement).toBe(cell("2026-03-03"));
    press("End", { ctrlKey: true });
    expect(document.activeElement).toBe(cell("2026-03-31"));
    press("Home", { ctrlKey: true });
    expect(document.activeElement).toBe(cell("2026-03-01"));
    press("ArrowUp");
    expect(document.activeElement).toBe(cell("2026-03-01"));
    act(() => cell("2026-03-07").focus());
    press("ArrowDown");
    expect(document.activeElement).toBe(cell("2026-03-08"));
    press("PageDown");
    expect(document.activeElement).toBe(cell("2026-03-29"));
  });
});
