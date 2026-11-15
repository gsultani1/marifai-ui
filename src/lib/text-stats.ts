// packages/ai-ui/src/lib/text-stats.ts
const segmenters = new Map<"word" | "grapheme", Intl.Segmenter | null>();

function segmenterFor(granularity: "word" | "grapheme"): Intl.Segmenter | null {
  if (!segmenters.has(granularity)) segmenters.set(granularity, typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity }) : null);
  return segmenters.get(granularity) ?? null;
}

/** Word and character counts that treat emoji and combined characters as one. */
export function countText(text: string): { words: number; characters: number } {
  const words = segmenterFor("word");
  const graphemes = segmenterFor("grapheme");
  const wordCount = words ? [...words.segment(text)].filter((segment) => segment.isWordLike).length : (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
  const characters = graphemes ? [...graphemes.segment(text)].length : [...text].length;
  return { words: wordCount, characters };
}
