// packages/ai-ui/src/lib/citations.ts
export interface CitationRewrite {
  /** The text with each resolved marker replaced by its number in brackets, e.g. "[2]". */
  text: string;
  /** Cited source ids in the order of their numbers; the first is [1]. */
  order: string[];
  /** Markers whose id matched no source; they are removed from `text`. */
  unresolved: string[];
}

const MARKER = /\[\^([\w:.-]+)\]|\[cite:\s*([\w:.,\s-]+)\]|【([\w:.-]+)】/g;

/**
 * Turns source ids in model output into readable numbers: `[^id]`,
 * `[cite:id]`, `[cite:a, b]` and `【id】` become `[1]`, `[2]` in order of
 * first appearance, repeated sources reuse their number, and markers for
 * unknown sources are dropped instead of showing raw ids.
 */
export function rewriteCitations(text: string, sourceIds: Iterable<string>): CitationRewrite {
  const known = new Set(sourceIds);
  const order: string[] = [];
  const unresolved: string[] = [];
  const numberFor = (id: string) => {
    let index = order.indexOf(id);
    if (index === -1) {
      order.push(id);
      index = order.length - 1;
    }
    return index + 1;
  };
  const rewritten = text.replace(MARKER, (_match, caret: string | undefined, cite: string | undefined, bracket: string | undefined) => {
    const ids = (caret ?? bracket ?? cite ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const numbers: number[] = [];
    for (const id of ids) {
      if (known.has(id)) numbers.push(numberFor(id));
      else if (!unresolved.includes(id)) unresolved.push(id);
    }
    return [...new Set(numbers)].map((number) => `[${number}]`).join("");
  });
  return { text: rewritten.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " "), order, unresolved };
}

/** Splits text into plain runs and `[n]` citation numbers, for rendering numbers as buttons. */
export function splitCitationNumbers(text: string): Array<{ text: string } | { citation: number }> {
  const parts: Array<{ text: string } | { citation: number }> = [];
  let last = 0;
  for (const match of text.matchAll(/\[(\d{1,3})\]/g)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ citation: Number(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
