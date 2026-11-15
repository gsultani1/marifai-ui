// packages/ai-ui/src/lib/markdown.ts
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const parser = unified().use(remarkParse).use(remarkGfm);

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const BLANK_LINE = /\n[ \t]*\n/g;
const DANGLING_MARKER = /(^|\s)[*_~`]+$/;
const INCOMPLETE_LINK = /(^|[^\\\w\]])(!?)\[([^[\]\n]*)(?:\](?:\([^()\s]*)?)?$/;

/**
 * Splits markdown into top-level blocks so completed blocks can be memoized
 * while the last one streams. Documents that use reference definitions or
 * footnotes stay whole because those resolve across blocks.
 */
export function splitMarkdownBlocks(markdown: string): string[] {
  const nodes = parser.parse(markdown).children;
  if (nodes.some((node) => node.type === "definition" || node.type === "footnoteDefinition")) {
    return [markdown];
  }
  const blocks: string[] = [];
  for (let index = 0; index < nodes.length; index++) {
    const start = index === 0 ? 0 : nodes[index]?.position?.start.offset;
    const end = nodes[index + 1]?.position?.start.offset ?? markdown.length;
    if (start === undefined) return [markdown];
    blocks.push(markdown.slice(start, end));
  }
  return blocks.length > 0 ? blocks : [markdown];
}

/**
 * Makes partially streamed markdown render cleanly: closes unterminated
 * emphasis, strikethrough and code spans, hides half-written links and
 * images, and drops a trailing delimiter that has no content yet. Only the
 * last paragraph is touched; an open code fence is left as is because
 * CommonMark already renders it to the end of the document.
 */
export function repairMarkdown(markdown: string): string {
  const fences = scanFences(markdown);
  if (fences.open) return markdown;
  const start = Math.max(fences.lastClosedEnd, lastBlankLineEnd(markdown));
  const tail = markdown.slice(start);
  return markdown.slice(0, start) + closeInlineMarkers(repairIncompleteLink(tail.replace(DANGLING_MARKER, "$1")));
}

function scanFences(markdown: string): { open: boolean; lastClosedEnd: number } {
  let fence: string | null = null;
  let offset = 0;
  let lastClosedEnd = 0;
  for (const line of markdown.split("\n")) {
    const match = FENCE.exec(line);
    if (match?.[1]) {
      const run = match[1];
      const rest = line.slice(match[0].length);
      if (fence === null) {
        if (!(run.startsWith("`") && rest.includes("`"))) fence = run;
      } else if (run[0] === fence[0] && run.length >= fence.length && rest.trim() === "") {
        fence = null;
        lastClosedEnd = Math.min(offset + line.length + 1, markdown.length);
      }
    }
    offset += line.length + 1;
  }
  return { open: fence !== null, lastClosedEnd };
}

function lastBlankLineEnd(markdown: string): number {
  let end = 0;
  for (const match of markdown.matchAll(BLANK_LINE)) end = match.index + match[0].length;
  return end;
}

function repairIncompleteLink(text: string): string {
  const match = INCOMPLETE_LINK.exec(text);
  if (!match) return text;
  const [, prefix = "", bang, label = ""] = match;
  if (!bang && /^[ xX]?$/.test(label)) return text;
  return text.slice(0, match.index) + prefix + (bang ? "" : label);
}

function closeInlineMarkers(text: string): string {
  const stack: string[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text.charAt(index);
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char !== "`" && char !== "*" && char !== "_" && char !== "~") {
      index++;
      continue;
    }
    const run = runLength(text, index, char);
    if (char === "`") {
      const close = findBacktickRun(text, index + run, run);
      if (close === -1) {
        stack.push(char.repeat(run));
        break;
      }
      index = close + run;
      continue;
    }
    if (char !== "~" && run <= 3) {
      toggleMarker(stack, text, index, char.repeat(run), char === "_");
    } else if (char === "~" && run === 2) {
      toggleMarker(stack, text, index, "~~", false);
    }
    index += run;
  }
  if (stack.length === 0) return text;
  const trimmed = text.trimEnd();
  return trimmed + stack.reverse().join("") + text.slice(trimmed.length);
}

function findBacktickRun(text: string, from: number, length: number): number {
  let index = text.indexOf("`", from);
  while (index !== -1) {
    const run = runLength(text, index, "`");
    if (run === length) return index;
    index = text.indexOf("`", index + run);
  }
  return -1;
}

function toggleMarker(stack: string[], text: string, index: number, marker: string, intraword: boolean): void {
  const before = text.charAt(index - 1);
  const after = text.charAt(index + marker.length);
  const canOpen = after !== "" && !/\s/.test(after);
  const canClose = before !== "" && !/\s/.test(before);
  if (intraword && /\w/.test(before) && /\w/.test(after)) return;
  const open = stack.lastIndexOf(marker);
  if (canClose && open !== -1) {
    stack.length = open;
  } else if (canOpen) {
    stack.push(marker);
  }
}

function runLength(text: string, index: number, char: string): number {
  let end = index;
  while (text.charAt(end) === char) end++;
  return end - index;
}
