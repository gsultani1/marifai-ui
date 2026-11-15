// packages/ai-ui/src/lib/ansi.ts
export interface AnsiStyle {
  /** CSS color for the text. */
  fg?: string;
  /** CSS color for the background. */
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  inverse?: boolean;
}

export interface AnsiSegment extends AnsiStyle {
  text: string;
}

const NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/** Theme color for one of the 16 basic ANSI colors; bright variants share the base token. */
export function ansiColor(index: number): string {
  return `var(--ansi-${NAMES[index % 8]})`;
}

function color256(index: number): string {
  if (index < 16) return ansiColor(index);
  if (index < 232) {
    const value = index - 16;
    const level = (step: number) => (step === 0 ? 0 : 55 + step * 40);
    return `rgb(${level(Math.floor(value / 36))}, ${level(Math.floor(value / 6) % 6)}, ${level(value % 6)})`;
  }
  const gray = 8 + (index - 232) * 10;
  return `rgb(${gray}, ${gray}, ${gray})`;
}

// eslint-disable-next-line no-control-regex
const SEQUENCE = /\u001b\[([0-9;?]*)([A-Za-z])|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[()][A-Za-z0-9]|\u001b[=>78DEHMc]/g;

function applySgr(style: AnsiStyle, params: number[]): AnsiStyle {
  const next = { ...style };
  for (let index = 0; index < params.length; index++) {
    const code = params[index]!;
    if (code === 0) for (const key of Object.keys(next) as Array<keyof AnsiStyle>) delete next[key];
    else if (code === 1) next.bold = true;
    else if (code === 2) next.dim = true;
    else if (code === 3) next.italic = true;
    else if (code === 4) next.underline = true;
    else if (code === 7) next.inverse = true;
    else if (code === 9) next.strike = true;
    else if (code === 22) {
      delete next.bold;
      delete next.dim;
    } else if (code === 23) delete next.italic;
    else if (code === 24) delete next.underline;
    else if (code === 27) delete next.inverse;
    else if (code === 29) delete next.strike;
    else if (code >= 30 && code <= 37) next.fg = ansiColor(code - 30);
    else if (code >= 90 && code <= 97) next.fg = ansiColor(code - 90);
    else if (code === 39) delete next.fg;
    else if (code >= 40 && code <= 47) next.bg = ansiColor(code - 40);
    else if (code >= 100 && code <= 107) next.bg = ansiColor(code - 100);
    else if (code === 49) delete next.bg;
    else if (code === 38 || code === 48) {
      const key = code === 38 ? "fg" : "bg";
      if (params[index + 1] === 5 && params[index + 2] !== undefined) {
        next[key] = color256(params[index + 2]!);
        index += 2;
      } else if (params[index + 1] === 2 && params[index + 4] !== undefined) {
        next[key] = `rgb(${params[index + 2]}, ${params[index + 3]}, ${params[index + 4]})`;
        index += 4;
      }
    }
  }
  return next;
}

// eslint-disable-next-line no-control-regex
const ERASE_LINE = /\u001b\[[012]?K/;

/**
 * The line as a terminal shows it after carriage returns: each part
 * overwrites the start of the line, and an erase-line sequence after a
 * carriage return clears what was there.
 */
export function applyCarriageReturns(line: string): string {
  const parts = line.split("\r");
  if (parts.length === 1) return line;
  let result = "";
  for (const part of parts) result = ERASE_LINE.test(part) ? part : part + result.slice(part.length);
  return result;
}

/**
 * Splits text with ANSI escape sequences into styled segments: colors (16,
 * 256 and true color), bold, dim, italic, underline, strike-through and
 * inverse. Cursor movement and other control sequences are dropped.
 */
export function parseAnsi(text: string, initial: AnsiStyle = {}): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  let style = initial;
  let cursor = 0;
  const push = (chunk: string) => {
    if (!chunk) return;
    const last = segments[segments.length - 1];
    if (last && JSON.stringify({ ...last, text: "" }) === JSON.stringify({ ...style, text: "" })) last.text += chunk;
    else segments.push({ ...style, text: chunk });
  };
  SEQUENCE.lastIndex = 0;
  for (const match of text.matchAll(SEQUENCE)) {
    push(text.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    if (match[2] === "m") style = applySgr(style, (match[1] || "0").split(";").map((value) => Number(value) || 0));
  }
  push(text.slice(cursor));
  return segments;
}

/** Removes ANSI escape sequences. */
export function stripAnsi(text: string): string {
  SEQUENCE.lastIndex = 0;
  return text.replace(SEQUENCE, "");
}
