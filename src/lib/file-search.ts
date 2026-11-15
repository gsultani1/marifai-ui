// packages/ai-ui/src/lib/file-search.ts
export interface SearchableFile {
  path: string;
  content: string;
}

export interface FileSearchOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  /** Stops after this many matches across all files. */
  maxResults?: number;
  /** Skips files larger than this many characters. */
  maxFileLength?: number;
}

export interface FileSearchMatch {
  /** 1-based. */
  line: number;
  /** 1-based column of the match start. */
  column: number;
  /** The line, trimmed around the match when long. */
  preview: string;
  /** Match ranges within `preview`. */
  ranges: Array<[start: number, end: number]>;
}

export interface FileSearchGroup {
  path: string;
  matches: FileSearchMatch[];
}

export interface FileSearchResult {
  groups: FileSearchGroup[];
  total: number;
  /** More matches exist than were returned. */
  truncated: boolean;
  skippedFiles: number;
  /** Set when a regular expression doesn't compile. */
  error?: string;
}

const PREVIEW_CONTEXT = 60;

/** Builds the search expression, or an error message for an invalid regular expression. */
export function buildSearchPattern(query: string, { matchCase = false, wholeWord = false, regex = false }: FileSearchOptions = {}): RegExp | string {
  const source = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const pattern = new RegExp(wholeWord ? `\\b(?:${source})\\b` : source, matchCase ? "g" : "gi");
    if (pattern.test("")) return "The expression matches empty text. Make it more specific.";
    pattern.lastIndex = 0;
    return pattern;
  } catch (error) {
    return error instanceof Error ? `Invalid regular expression: ${error.message.replace(/^Invalid regular expression: /, "")}` : "Invalid regular expression.";
  }
}

/** Searches file contents line by line with caps on matches and file size, for workspace search panels. */
export function searchFileContents(files: SearchableFile[], query: string, options: FileSearchOptions = {}): FileSearchResult {
  const { maxResults = 1000, maxFileLength = 2_000_000 } = options;
  const empty: FileSearchResult = { groups: [], total: 0, truncated: false, skippedFiles: 0 };
  if (!query) return empty;
  const pattern = buildSearchPattern(query, options);
  if (typeof pattern === "string") return { ...empty, error: pattern };
  const groups: FileSearchGroup[] = [];
  let total = 0;
  let skippedFiles = 0;
  for (const file of files) {
    if (file.content.length > maxFileLength) {
      skippedFiles++;
      continue;
    }
    const matches: FileSearchMatch[] = [];
    const lines = file.content.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      pattern.lastIndex = 0;
      const found = [...line.matchAll(pattern)];
      if (!found.length) continue;
      const first = found[0]!.index;
      const start = line.length > PREVIEW_CONTEXT * 3 ? Math.max(0, first - PREVIEW_CONTEXT) : 0;
      const end = Math.min(line.length, start + PREVIEW_CONTEXT * 3);
      const preview = `${start > 0 ? "…" : ""}${line.slice(start, end)}${end < line.length ? "…" : ""}`;
      const shift = start > 0 ? 1 - start : 0;
      matches.push({
        line: index + 1,
        column: first + 1,
        preview,
        ranges: found.filter((match) => match.index >= start && match.index + match[0].length <= end).map((match) => [match.index + shift, match.index + match[0].length + shift]),
      });
      total += found.length;
      if (total >= maxResults) {
        groups.push({ path: file.path, matches });
        return { groups, total: maxResults, truncated: true, skippedFiles };
      }
    }
    if (matches.length) groups.push({ path: file.path, matches });
  }
  return { groups, total, truncated: false, skippedFiles };
}
