// packages/ai-ui/src/lib/docs.ts
export interface DocHeading {
  level: number;
  text: string;
  id: string;
}

/** URL-safe id for a heading, like GitHub's: lowercase, punctuation removed, spaces to hyphens. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

/** Markdown headings up to `maxLevel`, outside fenced code, with unique ids in document order. */
export function extractHeadings(markdown: string, maxLevel = 3): DocHeading[] {
  const headings: DocHeading[] = [];
  const used = new Map<string, number>();
  let fence: string | null = null;
  let previous: string | null = null;
  const add = (level: number, raw: string) => {
    const text = raw.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~]/g, "").trim();
    const base = slugify(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    if (level <= maxLevel) headings.push({ level, text, id: count ? `${base}-${count}` : base });
  };
  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1]![0]!;
      else if (fenceMatch[1]![0] === fence) fence = null;
      previous = null;
      continue;
    }
    if (fence) continue;
    const atx = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (atx) {
      add(atx[1]!.length, atx[2]!);
      previous = null;
      continue;
    }
    const setext = /^\s{0,3}(=+|-+)\s*$/.exec(line);
    if (setext && previous) {
      add(setext[1]![0] === "=" ? 1 : 2, previous);
      previous = null;
      continue;
    }
    previous = line.trim() && !/^\s{0,3}([>*+|-]|\d+[.)])\s/.test(line) ? line.trim() : null;
  }
  return headings;
}
