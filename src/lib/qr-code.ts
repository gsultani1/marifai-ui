// packages/ai-ui/src/lib/qr-code.ts

/** Error correction level: roughly 7% (L), 15% (M), 25% (Q) or 30% (H) of the symbol can be damaged. */
export type QRErrorCorrectionLevel = "L" | "M" | "Q" | "H";

/** Data mode chosen for the input: digits only, the 45-character uppercase set, or UTF-8 bytes. */
export type QRMode = "numeric" | "alphanumeric" | "byte";

export interface QREncodeOptions {
  /** Defaults to "M". */
  ecLevel?: QRErrorCorrectionLevel;
  /** Smallest version (1 to 40) to use; the smallest version at or above it that fits is chosen. */
  minVersion?: number;
  /** Largest version allowed; input that does not fit throws a RangeError. Defaults to 40. */
  maxVersion?: number;
  /** Forces a mask pattern (0 to 7) instead of the one with the lowest penalty score. */
  mask?: number;
}

export interface QRCodeMatrix {
  version: number;
  /** Modules per side: 17 + 4 x version. */
  size: number;
  ecLevel: QRErrorCorrectionLevel;
  mode: QRMode;
  mask: number;
  /** True when byte mode starts with the UTF-8 ECI designator (input contains non-ASCII text). */
  eci: boolean;
  /** Row-major modules: `modules[y][x]` is true for a dark module. */
  modules: boolean[][];
}

const LEVEL_INDEX: Record<QRErrorCorrectionLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };
/** Two-bit level field of the format information. */
const LEVEL_FORMAT_BITS: Record<QRErrorCorrectionLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Error correction codewords per block, by level then version (index 0 unused). */
const EC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

/** Error correction blocks, by level then version (index 0 unused). */
const EC_BLOCKS: readonly (readonly number[])[] = [
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** Characters of alphanumeric mode, in code order. */
export const QR_ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const MODE_INDICATOR: Record<QRMode, number> = { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100 };
const COUNT_BITS: Record<QRMode, readonly [number, number, number]> = { numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] };
const ECI_UTF8 = 26;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
for (let index = 0, value = 1; index < 255; index++) {
  GF_EXP[index] = value;
  GF_LOG[value] = index;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let index = 255; index < 512; index++) GF_EXP[index] = GF_EXP[index - 255]!;

function gfMultiply(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

/** Coefficients (highest degree first, leading 1 omitted) of the product of (x - 2^i) for i below `degree`. */
function reedSolomonDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let step = 0; step < degree; step++) {
    for (let index = 0; index < degree; index++) {
      result[index] = gfMultiply(result[index]!, root);
      if (index + 1 < degree) result[index] = result[index]! ^ result[index + 1]!;
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: ArrayLike<number>, divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (let index = 0; index < data.length; index++) {
    const factor = data[index]! ^ result[0]!;
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let term = 0; term < divisor.length; term++) result[term] = result[term]! ^ gfMultiply(divisor[term]!, factor);
  }
  return result;
}

/** Modules available for data and error correction (everything but function patterns) in a version. */
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignments = Math.floor(version / 7) + 2;
    result -= (25 * alignments - 10) * alignments - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function totalCodewords(version: number): number {
  return Math.floor(rawDataModules(version) / 8);
}

function dataCodewords(version: number, level: QRErrorCorrectionLevel): number {
  const row = LEVEL_INDEX[level];
  return totalCodewords(version) - EC_CODEWORDS_PER_BLOCK[row]![version]! * EC_BLOCKS[row]![version]!;
}

function countBits(mode: QRMode, version: number): number {
  return COUNT_BITS[mode][version <= 9 ? 0 : version <= 26 ? 1 : 2];
}

/** Centers of the alignment patterns along one axis. */
function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const result = [6];
  for (let position = version * 4 + 10; result.length < count; position -= step) result.splice(1, 0, position);
  return result;
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let index = length - 1; index >= 0; index--) bits.push((value >>> index) & 1);
}

interface Segment {
  mode: QRMode;
  /** Characters for numeric and alphanumeric, bytes for byte mode. */
  count: number;
  bits: number[];
  eci: boolean;
}

function chooseSegment(text: string): Segment {
  const bits: number[] = [];
  if (/^[0-9]*$/.test(text)) {
    for (let index = 0; index < text.length; index += 3) {
      const group = text.slice(index, index + 3);
      appendBits(bits, Number(group), group.length * 3 + 1);
    }
    return { mode: "numeric", count: text.length, bits, eci: false };
  }
  if ([...text].every((character) => QR_ALPHANUMERIC_CHARSET.includes(character))) {
    for (let index = 0; index < text.length; index += 2) {
      const first = QR_ALPHANUMERIC_CHARSET.indexOf(text[index]!);
      if (index + 1 < text.length) appendBits(bits, first * 45 + QR_ALPHANUMERIC_CHARSET.indexOf(text[index + 1]!), 11);
      else appendBits(bits, first, 6);
    }
    return { mode: "alphanumeric", count: text.length, bits, eci: false };
  }
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) appendBits(bits, byte, 8);
  return { mode: "byte", count: bytes.length, bits, eci: bytes.some((byte) => byte >= 0x80) };
}

function segmentBits(segment: Segment, version: number): number | null {
  const counter = countBits(segment.mode, version);
  if (segment.count >= 2 ** counter) return null;
  return (segment.eci ? 12 : 0) + 4 + counter + segment.bits.length;
}

function encodeCodewords(segment: Segment, version: number, level: QRErrorCorrectionLevel): Uint8Array {
  const bits: number[] = [];
  if (segment.eci) {
    appendBits(bits, 0b0111, 4);
    appendBits(bits, ECI_UTF8, 8);
  }
  appendBits(bits, MODE_INDICATOR[segment.mode], 4);
  appendBits(bits, segment.count, countBits(segment.mode, version));
  for (const bit of segment.bits) bits.push(bit);
  const capacity = dataCodewords(version, level) * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);
  const data = new Uint8Array(capacity / 8);
  bits.forEach((bit, index) => {
    data[index >>> 3] = data[index >>> 3]! | (bit << (7 - (index & 7)));
  });
  return data;
}

/** Splits data into blocks, appends Reed-Solomon codewords and interleaves the result. */
function interleave(data: Uint8Array, version: number, level: QRErrorCorrectionLevel): Uint8Array {
  const row = LEVEL_INDEX[level];
  const blockCount = EC_BLOCKS[row]![version]!;
  const ecLength = EC_CODEWORDS_PER_BLOCK[row]![version]!;
  const total = totalCodewords(version);
  const shortBlocks = blockCount - (total % blockCount);
  const shortLength = Math.floor(total / blockCount);
  const divisor = reedSolomonDivisor(ecLength);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let block = 0, offset = 0; block < blockCount; block++) {
    const length = shortLength - ecLength + (block < shortBlocks ? 0 : 1);
    const slice = data.subarray(offset, offset + length);
    offset += length;
    dataBlocks.push(slice);
    ecBlocks.push(reedSolomonRemainder(slice, divisor));
  }
  const result = new Uint8Array(total);
  let cursor = 0;
  for (let index = 0; index <= shortLength - ecLength; index++) {
    for (const block of dataBlocks) if (index < block.length) result[cursor++] = block[index]!;
  }
  for (let index = 0; index < ecLength; index++) {
    for (const block of ecBlocks) result[cursor++] = block[index]!;
  }
  return result;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** 15-bit format information: level and mask protected by a BCH(15,5) code, then XOR-masked. */
function formatBits(level: QRErrorCorrectionLevel, mask: number): number {
  const data = (LEVEL_FORMAT_BITS[level] << 3) | mask;
  let remainder = data;
  for (let index = 0; index < 10; index++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  return ((data << 10) | remainder) ^ 0x5412;
}

/** 18-bit version information: the version protected by a BCH(18,6) code. */
function versionBits(version: number): number {
  let remainder = version;
  for (let index = 0; index < 12; index++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  return (version << 12) | remainder;
}

class Grid {
  readonly modules: boolean[][];
  readonly reserved: boolean[][];

  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }

  set(x: number, y: number, dark: boolean): void {
    this.modules[y]![x] = dark;
    this.reserved[y]![x] = true;
  }

  drawFunctionPatterns(version: number): void {
    const { size } = this;
    for (let index = 0; index < size; index++) {
      this.set(6, index, index % 2 === 0);
      this.set(index, 6, index % 2 === 0);
    }
    for (const [cx, cy] of [
      [3, 3],
      [size - 4, 3],
      [3, size - 4],
    ] as const) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < size && y >= 0 && y < size) this.set(x, y, distance !== 2 && distance !== 4);
        }
      }
    }
    const positions = alignmentPositions(version);
    const last = positions.length - 1;
    positions.forEach((cy, row) => {
      positions.forEach((cx, column) => {
        if ((row === 0 && column === 0) || (row === 0 && column === last) || (row === last && column === 0)) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      });
    });
    this.drawFormat(0);
    if (version >= 7) {
      const bits = versionBits(version);
      for (let index = 0; index < 18; index++) {
        const dark = ((bits >>> index) & 1) === 1;
        const a = size - 11 + (index % 3);
        const b = Math.floor(index / 3);
        this.set(a, b, dark);
        this.set(b, a, dark);
      }
    }
  }

  drawFormat(bits: number): void {
    const { size } = this;
    const bit = (index: number) => ((bits >>> index) & 1) === 1;
    for (let index = 0; index <= 5; index++) this.set(8, index, bit(index));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let index = 9; index < 15; index++) this.set(14 - index, 8, bit(index));
    for (let index = 0; index < 8; index++) this.set(size - 1 - index, 8, bit(index));
    for (let index = 8; index < 15; index++) this.set(8, size - 15 + index, bit(index));
    this.set(8, size - 8, true);
  }

  /** Places codewords in the two-column zigzag from the bottom-right corner, skipping function modules. */
  drawCodewords(codewords: Uint8Array): void {
    const { size } = this;
    const totalBits = codewords.length * 8;
    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let step = 0; step < size; step++) {
        const y = upward ? size - 1 - step : step;
        for (let column = 0; column < 2; column++) {
          const x = right - column;
          if (this.reserved[y]![x]) continue;
          this.modules[y]![x] = index < totalBits && ((codewords[index >>> 3]! >>> (7 - (index & 7))) & 1) === 1;
          index++;
        }
      }
    }
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.reserved[y]![x] && maskBit(mask, x, y)) this.modules[y]![x] = !this.modules[y]![x];
      }
    }
  }

  penalty(): number {
    const { size, modules } = this;
    let score = 0;
    const scanLine = (line: boolean[]) => {
      let run = 1;
      for (let index = 1; index <= line.length; index++) {
        if (index < line.length && line[index] === line[index - 1]) {
          run++;
          continue;
        }
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
      const light = (index: number) => index < 0 || index >= line.length || !line[index];
      for (let start = 0; start + 7 <= line.length; start++) {
        if (!(line[start] && !line[start + 1] && line[start + 2] && line[start + 3] && line[start + 4] && !line[start + 5] && line[start + 6])) continue;
        if (light(start - 1) && light(start - 2) && light(start - 3) && light(start - 4)) score += 40;
        if (light(start + 7) && light(start + 8) && light(start + 9) && light(start + 10)) score += 40;
      }
    };
    for (let y = 0; y < size; y++) scanLine(modules[y]!);
    for (let x = 0; x < size; x++) scanLine(modules.map((row) => row[x]!));
    let dark = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const value = modules[y]![x]!;
        if (value) dark++;
        if (x + 1 < size && y + 1 < size && value === modules[y]![x + 1] && value === modules[y + 1]![x] && value === modules[y + 1]![x + 1]) score += 3;
      }
    }
    const total = size * size;
    score += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

/**
 * Encodes text as a QR Code (ISO/IEC 18004, model 2). Digits use numeric
 * mode, text within the uppercase alphanumeric set uses alphanumeric mode,
 * and anything else is UTF-8 in byte mode (with the UTF-8 ECI designator
 * when it contains non-ASCII characters). The smallest version that fits is
 * chosen, and the mask with the lowest penalty score is applied. Throws a
 * RangeError when the text does not fit.
 */
export function encodeQR(text: string, options: QREncodeOptions = {}): QRCodeMatrix {
  const ecLevel = options.ecLevel ?? "M";
  const minVersion = Math.max(1, Math.min(40, Math.floor(options.minVersion ?? 1)));
  const maxVersion = Math.max(minVersion, Math.min(40, Math.floor(options.maxVersion ?? 40)));
  if (options.mask !== undefined && !(Number.isInteger(options.mask) && options.mask >= 0 && options.mask <= 7)) {
    throw new RangeError(`QR mask must be an integer from 0 to 7, received ${options.mask}.`);
  }
  const segment = chooseSegment(text);
  let version = minVersion;
  for (; version <= maxVersion; version++) {
    const needed = segmentBits(segment, version);
    if (needed !== null && needed <= dataCodewords(version, ecLevel) * 8) break;
  }
  if (version > maxVersion) {
    const capacity = dataCodewords(maxVersion, ecLevel) * 8;
    const needed = segmentBits(segment, maxVersion) ?? (segment.eci ? 12 : 0) + 4 + countBits(segment.mode, maxVersion) + segment.bits.length;
    throw new RangeError(
      `Text is too long for a QR code: ${segment.count} ${segment.mode === "byte" ? "bytes" : "characters"} in ${segment.mode} mode need ${needed} bits, but version ${maxVersion} at error correction level ${ecLevel} holds ${capacity}.`,
    );
  }
  const codewords = interleave(encodeCodewords(segment, version, ecLevel), version, ecLevel);
  const grid = new Grid(version * 4 + 17);
  grid.drawFunctionPatterns(version);
  grid.drawCodewords(codewords);
  let mask = options.mask ?? 0;
  if (options.mask === undefined) {
    let best = Number.POSITIVE_INFINITY;
    for (let candidate = 0; candidate < 8; candidate++) {
      grid.applyMask(candidate);
      grid.drawFormat(formatBits(ecLevel, candidate));
      const score = grid.penalty();
      if (score < best) {
        best = score;
        mask = candidate;
      }
      grid.applyMask(candidate);
    }
  }
  grid.applyMask(mask);
  grid.drawFormat(formatBits(ecLevel, mask));
  return { version, size: grid.size, ecLevel, mode: segment.mode, mask, eci: segment.eci, modules: grid.modules };
}

/** SVG path data with one subpath per horizontal run of dark modules, offset by a quiet zone of `margin` modules. */
export function qrSvgPath(modules: readonly (readonly boolean[])[], margin = 4): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let end = x;
      while (end + 1 < row.length && row[end + 1]) end++;
      const length = end - x + 1;
      parts.push(`M${x + margin} ${y + margin}h${length}v1h-${length}z`);
      x = end;
    }
  });
  return parts.join("");
}

export interface QRSvgOptions {
  /** Quiet zone in modules; the standard asks for 4. */
  margin?: number;
  foreground?: string;
  background?: string;
  /** Rendered width and height in pixels. */
  size?: number;
}

/** A standalone SVG document for the matrix, for downloads and server rendering. */
export function qrToSvgString(matrix: QRCodeMatrix, { margin = 4, foreground = "#000000", background = "#ffffff", size }: QRSvgOptions = {}): string {
  const extent = matrix.size + margin * 2;
  const attribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const dimensions = size ? ` width="${size}" height="${size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}"${dimensions} shape-rendering="crispEdges"><rect width="${extent}" height="${extent}" fill="${attribute(background)}"/><path d="${qrSvgPath(matrix.modules, margin)}" fill="${attribute(foreground)}"/></svg>`;
}
