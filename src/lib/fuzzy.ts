// packages/ai-ui/src/lib/fuzzy.ts
export interface FuzzyMatch {
  /** Higher is better. */
  score: number;
  /** Indexes of the matched characters in the text, for highlighting. */
  indices: number[];
}

const BOUNDARY = /[\s/\\._\-:([{]/;

/**
 * Subsequence match in the spirit of editor quick-open: every query
 * character must appear in order. Consecutive runs, word starts, camelCase
 * humps and a match at the very start score higher; gaps cost a little.
 * Returns null when the query doesn't match.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return { score: 0, indices: [] };
  const haystack = text.toLowerCase();
  const direct = haystack.indexOf(needle);
  if (direct !== -1) {
    const atBoundary = direct === 0 || BOUNDARY.test(text[direct - 1]!);
    return { score: 1000 + needle.length * 20 + (direct === 0 ? 200 : atBoundary ? 100 : 0) - direct, indices: Array.from({ length: needle.length }, (_, index) => direct + index) };
  }
  const indices: number[] = [];
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const char of needle) {
    if (char === " ") continue;
    const found = haystack.indexOf(char, from);
    if (found === -1) return null;
    const before = text[found - 1];
    const boundary = found === 0 || (before !== undefined && BOUNDARY.test(before));
    const hump = before !== undefined && /[a-z0-9]/.test(before) && /[A-Z]/.test(text[found]!);
    score += 10 + (found === previous + 1 ? 15 : 0) + (boundary ? 20 : 0) + (hump ? 15 : 0) - Math.min(found - from, 10);
    indices.push(found);
    previous = found;
    from = found + 1;
  }
  return { score, indices };
}

/** Ranks items by their best-matching field and drops non-matches; ties keep the original order. */
export function fuzzyFilter<T>(items: T[], query: string, fields: (item: T) => string[]): Array<{ item: T; match: FuzzyMatch; field: number }> {
  if (!query.trim()) return items.map((item) => ({ item, match: { score: 0, indices: [] }, field: 0 }));
  const results: Array<{ item: T; match: FuzzyMatch; field: number; order: number }> = [];
  for (const [order, item] of items.entries()) {
    let best: { match: FuzzyMatch; field: number } | null = null;
    for (const [field, value] of fields(item).entries()) {
      const match = fuzzyMatch(query, value);
      if (match && (!best || match.score - field * 50 > best.match.score - best.field * 50)) best = { match, field };
    }
    if (best) results.push({ item, order, ...best });
  }
  return results.sort((a, b) => b.match.score - b.field * 50 - (a.match.score - a.field * 50) || a.order - b.order).map(({ item, match, field }) => ({ item, match, field }));
}

/** Splits text into plain and highlighted runs for rendering matches. */
export function highlightRanges(text: string, indices: number[]): Array<{ text: string; match: boolean }> {
  if (!indices.length) return [{ text, match: false }];
  const set = new Set(indices);
  const parts: Array<{ text: string; match: boolean }> = [];
  for (let index = 0; index < text.length; index++) {
    const match = set.has(index);
    const last = parts[parts.length - 1];
    if (last && last.match === match) last.text += text[index];
    else parts.push({ text: text[index]!, match });
  }
  return parts;
}

/** Splits text into plain and highlighted runs wherever any of the words or phrases occurs, ignoring case. */
export function highlightTerms(text: string, terms: readonly string[]): Array<{ text: string; match: boolean }> {
  const words = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length > 1))].sort((a, b) => b.length - a.length);
  if (!words.length) return [{ text, match: false }];
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({ text: part, match: words.some((word) => word.toLowerCase() === part.toLowerCase()) }));
}
