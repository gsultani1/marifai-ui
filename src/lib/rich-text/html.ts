// packages/ai-ui/src/lib/rich-text/html.ts
import { type DOMOutputSpec, DOMParser as ProseMirrorDOMParser, DOMSerializer, type MarkSpec, type Node as ProseMirrorNode, type NodeSpec, Schema } from "prosemirror-model";
import { tableNodes } from "prosemirror-tables";

import { parseColor, toHex } from "../color.js";
import { htmlToText } from "../html-text.js";
import { safeUrl } from "../safe-url.js";
import { alignAttr, richTextSchema, safeImageSrc } from "./schema.js";

/** Deepest paragraph indent; each level is INDENT_STEP_PX of left margin. */
export const MAX_INDENT = 8;
export const INDENT_STEP_PX = 40;

const UNIT_PX: Record<string, number> = { px: 1, pt: 4 / 3, pc: 16, em: 16, rem: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 };

/** A CSS length in pixels, treating em and rem as 16px; null for percentages, keywords and junk. */
export function cssLengthToPx(value: string): number | null {
  const match = /^(-?\d*\.?\d+)(px|pt|pc|em|rem|in|cm|mm)?$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number.parseFloat(match[1]!);
  return Number.isFinite(amount) ? amount * UNIT_PX[(match[2] ?? "px").toLowerCase()]! : null;
}

const RESERVED = /^(?:inherit|initial|unset|revert|revert-layer|auto|currentcolor|transparent|windowtext|window)$/;

/**
 * A text color safe to put in a style attribute: hex, rgb() or hsl()
 * normalized to hex, or a bare color keyword. Transparent, inherited and
 * Word's system colors return null.
 */
export function safeCssColor(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text || RESERVED.test(text)) return null;
  if (/^(?:#|rgba?\(|hsla?\()/.test(text)) {
    const parsed = parseColor(text);
    return parsed && parsed.a > 0 ? toHex(parsed) : null;
  }
  return /^[a-z]{3,24}$/.test(text) ? text : null;
}

/** A font-family list made of names, quotes, commas and hyphens only. */
export function safeFontFamily(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > 200 || !/^[\w\s,'"-]+$/.test(text) || RESERVED.test(text.toLowerCase())) return null;
  return text;
}

const FONT_KEYWORDS: Record<string, number> = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
const FONT_TAG_SIZES = [10, 13, 16, 18, 24, 32, 48];

/** A font size as whole pixels between 6 and 144, e.g. "11pt" becomes "15px". */
export function safeFontSize(value: string): string | null {
  const text = value.trim().toLowerCase();
  const px = FONT_KEYWORDS[text] ?? cssLengthToPx(text);
  if (px === null) return null;
  const rounded = Math.round(px);
  return rounded >= 6 && rounded <= 144 ? `${rounded}px` : null;
}

/** The first family in a font-family list, unquoted and lowercase. */
export function primaryFontFamily(value: string): string {
  return (value.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Embeds                                                              */
/* ------------------------------------------------------------------ */

export interface EmbedSource {
  kind: "iframe" | "video";
  /** Normalized player or file URL. */
  src: string;
  provider: "YouTube" | "Vimeo" | "Loom" | "Video";
}

function startSeconds(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  return match ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : 0;
}

/**
 * The embed for a YouTube, Vimeo or Loom link, or an https video file, or
 * null for anything else. Only these players are allowed, so pasted or
 * stored iframes from other sites are dropped. YouTube uses its
 * privacy-enhanced domain.
 */
export function embedFromUrl(input: string): EmbedSource | null {
  const href = safeUrl(input.trim(), ["http:", "https:"]);
  if (!href) return null;
  const url = new URL(href);
  const host = url.hostname.replace(/^(?:www|m)\./, "");
  const segments = url.pathname.split("/").filter(Boolean);
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    const candidate = host === "youtu.be" ? segments[0] : segments[0] === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live", "v"].includes(segments[0] ?? "") ? segments[1] : undefined;
    if (!candidate || !/^[\w-]{6,20}$/.test(candidate)) return null;
    const start = startSeconds(url.searchParams.get("t") ?? url.searchParams.get("start"));
    return { kind: "iframe", provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${candidate}${start ? `?start=${start}` : ""}` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = host === "player.vimeo.com" ? (segments[0] === "video" ? segments.slice(1) : []) : segments;
    const id = parts[0];
    if (!id || !/^\d{3,12}$/.test(id)) return null;
    const hash = (parts[1] && /^[\da-f]{6,20}$/i.test(parts[1]) ? parts[1] : url.searchParams.get("h")) ?? "";
    return { kind: "iframe", provider: "Vimeo", src: `https://player.vimeo.com/video/${id}${/^[\da-f]{6,20}$/i.test(hash) ? `?h=${hash}` : ""}` };
  }
  if (host === "loom.com" && (segments[0] === "share" || segments[0] === "embed") && /^[\da-f]{32}$/i.test(segments[1] ?? "")) {
    return { kind: "iframe", provider: "Loom", src: `https://www.loom.com/embed/${segments[1]!.toLowerCase()}` };
  }
  if (url.protocol === "https:" && /\.(?:mp4|m4v|webm|ogv|ogg|mov)$/i.test(url.pathname)) return { kind: "video", provider: "Video", src: url.href };
  return null;
}

/** Attributes every embedded player iframe gets, wherever it is rendered. */
export const EMBED_IFRAME_ATTRS = {
  loading: "lazy",
  allow: "fullscreen; picture-in-picture; encrypted-media",
  allowfullscreen: "",
  referrerpolicy: "strict-origin-when-cross-origin",
  sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups",
  style: "width: 100%; aspect-ratio: 16 / 9; border: 0",
};

function embedAttrs(element: Element | null): Record<string, string> | false {
  if (!element) return false;
  const src = element.tagName === "VIDEO" ? (element.getAttribute("src") ?? element.querySelector("source[src]")?.getAttribute("src")) : element.getAttribute("src");
  const embed = embedFromUrl(src ?? "");
  if (!embed || (element.tagName === "VIDEO") !== (embed.kind === "video")) return false;
  return { ...embed, title: element.getAttribute("title") ?? "" };
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

function indentAttr(element: HTMLElement): number {
  const px = cssLengthToPx(element.style.marginLeft || element.style.paddingLeft || "0") ?? 0;
  return Math.max(0, Math.min(MAX_INDENT, Math.round(px / INDENT_STEP_PX)));
}

function blockStyle(node: ProseMirrorNode): Record<string, string> {
  const parts: string[] = [];
  if (node.attrs.align) parts.push(`text-align: ${node.attrs.align as string}`);
  if (node.attrs.indent) parts.push(`margin-left: ${(node.attrs.indent as number) * INDENT_STEP_PX}px`);
  return parts.length ? { style: parts.join("; ") } : {};
}

function imageWidth(element: HTMLElement): number | null {
  const raw = element.getAttribute("width") ?? element.style.width;
  const px = raw ? cssLengthToPx(raw) : null;
  return px && px >= 16 ? Math.min(4000, Math.round(px)) : null;
}

/** How a captioned image sits in the text: floated left or right, centered, or across the full width. */
export type FigureAlign = "left" | "center" | "right" | "wide";
export const FIGURE_ALIGNS: readonly FigureAlign[] = ["left", "center", "right", "wide"];

/** Callout tones, each a colored panel with an icon in the editor and in HTML_CONTENT_CSS. */
export type CalloutTone = "info" | "success" | "warning" | "danger" | "note";
export const CALLOUT_TONES: readonly CalloutTone[] = ["info", "success", "warning", "danger", "note"];

/** Longest footnote text kept when parsing. */
export const MAX_FOOTNOTE_LENGTH = 2000;

const FIGURE_STYLES: Record<FigureAlign, string> = {
  left: "float: left; margin: 0.25em 1.5em 1em 0; max-width: 50%",
  right: "float: right; margin: 0.25em 0 1em 1.5em; max-width: 50%",
  center: "margin: 1em auto; text-align: center",
  wide: "margin: 1em 0",
};

function figureAlign(element: HTMLElement): FigureAlign {
  const data = element.dataset.align as FigureAlign | undefined;
  if (data && FIGURE_ALIGNS.includes(data)) return data;
  const float = element.style.float;
  return float === "left" || float === "right" ? float : "center";
}

const SAFE_ID = /^[\w-]{1,64}$/;

/** A comment or change id: letters, digits, underscores and hyphens, at most 64. */
export function safeMarkId(value: string | null | undefined): string | null {
  return value && SAFE_ID.test(value) ? value : null;
}

/** An author name for comments and tracked changes: control characters removed, at most 80 characters. */
export function safeAuthor(value: string | null | undefined): string {
  return (value ?? "").replace(/\p{Cc}/gu, "").trim().slice(0, 80);
}

/** An ISO 8601 timestamp, or "" for anything else. */
export function safeTimestamp(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : "";
}

function changeMark(tag: "ins" | "del", excludes: string): MarkSpec {
  return {
    attrs: { id: {}, author: { default: "" }, date: { default: "" } },
    inclusive: false,
    excludes,
    parseDOM: [
      {
        tag: `${tag}[data-change-id]`,
        priority: 60,
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          const id = safeMarkId(element.dataset.changeId);
          return id ? { id, author: safeAuthor(element.dataset.author), date: safeTimestamp(element.dataset.date) } : false;
        },
      },
    ],
    toDOM: (mark): DOMOutputSpec => {
      const { id, author, date } = mark.attrs as { id: string; author: string; date: string };
      return [tag, { "data-change-id": id, ...(author ? { "data-author": author } : {}), ...(date ? { "data-date": date } : {}) }, 0];
    },
  };
}

const tableSpecs = tableNodes({
  tableGroup: "block",
  cellContent: "block+",
  cellAttributes: {
    background: {
      default: null,
      getFromDOM: (dom) => safeCssColor((dom as HTMLElement).dataset.background ?? (dom as HTMLElement).style.backgroundColor ?? ""),
      setDOMAttr: (value, attrs) => {
        if (typeof value === "string" && value) attrs.style = `${(attrs.style as string | undefined) ?? ""}background-color: ${value};`;
      },
    },
  },
});

const base = richTextSchema.spec;

const nodes = base.nodes
  .update("paragraph", {
    attrs: { align: { default: null }, indent: { default: 0 } },
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p", getAttrs: (dom) => ({ align: alignAttr(dom as HTMLElement), indent: indentAttr(dom as HTMLElement) }) }],
    toDOM: (node): DOMOutputSpec => ["p", blockStyle(node), 0],
  } satisfies NodeSpec)
  .update("heading", {
    attrs: { level: { default: 1 }, align: { default: null }, indent: { default: 0 } },
    content: "inline*",
    group: "block",
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, getAttrs: (dom: HTMLElement) => ({ level, align: alignAttr(dom), indent: indentAttr(dom) }) })),
    toDOM: (node): DOMOutputSpec => [`h${node.attrs.level as number}`, blockStyle(node), 0],
  } satisfies NodeSpec)
  .update("image", {
    inline: true,
    attrs: { src: {}, alt: { default: "" }, title: { default: null }, width: { default: null } },
    group: "inline",
    draggable: true,
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          const src = safeImageSrc(element.getAttribute("src"));
          return src ? { src, alt: element.getAttribute("alt") ?? "", title: element.getAttribute("title"), width: imageWidth(element) } : false;
        },
      },
    ],
    toDOM: (node): DOMOutputSpec => [
      "img",
      { src: node.attrs.src as string, alt: node.attrs.alt as string, ...(node.attrs.title ? { title: node.attrs.title as string } : {}), ...(node.attrs.width ? { width: String(node.attrs.width) } : {}) },
    ],
  } satisfies NodeSpec)
  .addToEnd("embed", {
    attrs: { src: {}, kind: { default: "iframe" }, provider: { default: "Video" }, title: { default: "" } },
    group: "block",
    atom: true,
    draggable: true,
    parseDOM: [
      { tag: "div[data-embed]", priority: 60, getAttrs: (dom) => embedAttrs((dom as HTMLElement).querySelector("iframe, video")) },
      { tag: "iframe[src]", getAttrs: (dom) => embedAttrs(dom as HTMLElement) },
      { tag: "video", getAttrs: (dom) => embedAttrs(dom as HTMLElement) },
    ],
    toDOM: (node): DOMOutputSpec => {
      const { src, kind, provider, title } = node.attrs as { src: string; kind: string; provider: string; title: string };
      const label = title || `${provider} video`;
      return ["div", { "data-embed": kind }, kind === "video" ? ["video", { src, controls: "", preload: "metadata", title: label, style: "width: 100%" }] : ["iframe", { src, title: label, ...EMBED_IFRAME_ATTRS }]];
    },
  } satisfies NodeSpec)
  .update("table", tableSpecs.table)
  .update("table_row", tableSpecs.table_row)
  .update("table_cell", tableSpecs.table_cell)
  .update("table_header", tableSpecs.table_header)
  .addToEnd("figure", {
    attrs: { src: {}, alt: { default: "" }, title: { default: null }, width: { default: null }, align: { default: "center" } },
    content: "inline*",
    group: "block",
    draggable: true,
    isolating: true,
    parseDOM: [
      {
        tag: "figure",
        contentElement: (dom) => (dom as HTMLElement).querySelector("figcaption") ?? (dom as HTMLElement).ownerDocument.createElement("figcaption"),
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          const image = element.querySelector<HTMLElement>("img[src]");
          const src = safeImageSrc(image?.getAttribute("src"));
          return image && src ? { src, alt: image.getAttribute("alt") ?? "", title: image.getAttribute("title"), width: imageWidth(image), align: figureAlign(element) } : false;
        },
      },
    ],
    toDOM: (node): DOMOutputSpec => {
      const { src, alt, title, width, align } = node.attrs as { src: string; alt: string; title: string | null; width: number | null; align: FigureAlign };
      const image: DOMOutputSpec = ["img", { src, alt, ...(title ? { title } : {}), ...(width ? { width: String(width) } : {}), style: align === "wide" ? "width: 100%; height: auto" : "max-width: 100%; height: auto" }];
      const floated = align === "left" || align === "right";
      const attrs = { "data-align": align, style: `${FIGURE_STYLES[align] ?? FIGURE_STYLES.center}${floated && width ? `; width: ${width}px` : ""}` };
      return node.content.size ? ["figure", attrs, image, ["figcaption", 0]] : ["figure", attrs, image];
    },
  } satisfies NodeSpec)
  .addToEnd("callout", {
    attrs: { tone: { default: "info" } },
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [
      {
        tag: "aside[data-callout]",
        getAttrs: (dom) => {
          const tone = (dom as HTMLElement).dataset.callout as CalloutTone;
          return { tone: CALLOUT_TONES.includes(tone) ? tone : "info" };
        },
      },
    ],
    toDOM: (node): DOMOutputSpec => ["aside", { "data-callout": node.attrs.tone as string }, 0],
  } satisfies NodeSpec)
  .addToEnd("columns", {
    content: "column{2,3}",
    group: "block",
    defining: true,
    parseDOM: [{ tag: "div[data-columns]" }],
    toDOM: (node): DOMOutputSpec => ["div", { "data-columns": String(node.childCount), style: `display: grid; grid-template-columns: repeat(${node.childCount}, minmax(0, 1fr)); gap: 24px` }, 0],
  } satisfies NodeSpec)
  .addToEnd("column", {
    content: "block+",
    isolating: true,
    parseDOM: [{ tag: "div[data-column]" }],
    toDOM: (): DOMOutputSpec => ["div", { "data-column": "" }, 0],
  } satisfies NodeSpec)
  .addToEnd("page_break", {
    group: "block",
    atom: true,
    parseDOM: [{ tag: "div[data-page-break]" }, { tag: "hr[data-page-break]", priority: 60 }],
    toDOM: (): DOMOutputSpec => ["div", { "data-page-break": "", style: "break-after: page; page-break-after: always" }],
  } satisfies NodeSpec)
  .addToEnd("toc", {
    group: "block",
    atom: true,
    parseDOM: [{ tag: "nav[data-toc]" }, { tag: "section[data-footnotes]", ignore: true }],
    toDOM: (): DOMOutputSpec => ["nav", { "data-toc": "", "aria-label": "Table of contents" }],
  } satisfies NodeSpec)
  .addToEnd("footnote", {
    inline: true,
    group: "inline",
    atom: true,
    attrs: { text: { default: "" } },
    parseDOM: [{ tag: "sup[data-footnote]", priority: 60, getAttrs: (dom) => ({ text: ((dom as HTMLElement).dataset.footnote ?? "").replace(/(?![\t\n])\p{Cc}/gu, "").slice(0, MAX_FOOTNOTE_LENGTH) }) }],
    toDOM: (node): DOMOutputSpec => ["sup", { "data-footnote": node.attrs.text as string }, "*"],
  } satisfies NodeSpec);

function styleMark(property: string, normalize: (value: string) => string | null, extra: NonNullable<MarkSpec["parseDOM"]> = []): MarkSpec {
  return {
    attrs: { value: {} },
    parseDOM: [
      ...extra,
      {
        style: property,
        getAttrs: (raw) => {
          const value = normalize(raw as string);
          return value ? { value } : false;
        },
      },
    ],
    toDOM: (mark): DOMOutputSpec => ["span", { style: `${property}: ${mark.attrs.value as string}` }, 0],
  };
}

const fontAttr = (attribute: string, normalize: (value: string) => string | null) => ({
  tag: `font[${attribute}]`,
  getAttrs: (dom: HTMLElement) => {
    const value = normalize(dom.getAttribute(attribute) ?? "");
    return value ? { value } : false;
  },
});

const marks = base.marks.remove("comment").append({
  font_family: styleMark("font-family", safeFontFamily, [fontAttr("face", safeFontFamily)]),
  font_size: styleMark("font-size", safeFontSize, [fontAttr("size", (size) => (/^[1-7]$/.test(size.trim()) ? `${FONT_TAG_SIZES[Number(size) - 1]}px` : null))]),
  text_color: styleMark("color", safeCssColor, [fontAttr("color", safeCssColor)]),
  background_color: styleMark("background-color", safeCssColor),
  comment: {
    attrs: { id: {} },
    inclusive: false,
    excludes: "",
    parseDOM: [
      {
        tag: "span[data-comment-id]",
        getAttrs: (dom) => {
          const id = safeMarkId((dom as HTMLElement).dataset.commentId);
          return id ? { id } : false;
        },
      },
    ],
    toDOM: (mark): DOMOutputSpec => ["span", { "data-comment-id": mark.attrs.id as string }, 0],
  } satisfies MarkSpec,
  insertion: changeMark("ins", "deletion"),
  deletion: changeMark("del", "insertion"),
});

/**
 * Schema for HtmlEditor: the rich text nodes and marks plus paragraph and
 * heading indents, image widths, YouTube, Vimeo, Loom and video file
 * embeds, captioned figures, callouts, two and three column layouts, page
 * breaks, a table of contents, footnotes, table cell backgrounds, anchored
 * comments, tracked insertions and deletions, and font family, font size,
 * text color and background color marks. Every attribute passes through an
 * allowlist or a normalizer when parsed, so parsing is also sanitizing.
 */
export const htmlSchema = new Schema({ nodes, marks });

/* ------------------------------------------------------------------ */
/* Parse and serialize                                                 */
/* ------------------------------------------------------------------ */

/**
 * Moves table cell backgrounds into data-background before parsing, so the
 * color lands on the cell instead of also becoming a highlight on its text.
 */
function liftCellBackgrounds(root: ParentNode): void {
  for (const cell of root.querySelectorAll<HTMLElement>("td[style], th[style]")) {
    const color = cell.style.backgroundColor;
    if (!color) continue;
    cell.dataset.background = color;
    cell.style.removeProperty("background-color");
    cell.style.removeProperty("background");
    if (!cell.getAttribute("style")?.trim()) cell.removeAttribute("style");
  }
}

/**
 * Parses HTML into a document of the schema. The HTML is read in an inert
 * document, so scripts never run and images never load, and only what the
 * schema allows survives. Without a DOM it keeps the text only.
 */
export function htmlToDoc(html: string, schema: Schema = htmlSchema): ProseMirrorNode {
  if (typeof DOMParser === "undefined") {
    const paragraphs = htmlToText(html)
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((text) => schema.nodes.paragraph!.create(null, schema.text(text)));
    return schema.topNodeType.create(null, paragraphs.length ? paragraphs : [schema.nodes.paragraph!.create()]);
  }
  const body = new DOMParser().parseFromString(html, "text/html").body;
  liftCellBackgrounds(body);
  return ProseMirrorDOMParser.fromSchema(schema).parse(body);
}

function isEmptyDoc(doc: ProseMirrorNode): boolean {
  const first = doc.firstChild;
  return doc.childCount === 1 && first !== null && first.type.name === "paragraph" && first.content.size === 0 && !first.attrs.align && !first.attrs.indent;
}

/** A URL fragment for a heading: lowercase words joined by hyphens, unique within `taken`. */
export function headingSlug(text: string, taken: Set<string>): string {
  const base =
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section";
  let slug = base;
  for (let suffix = 2; taken.has(slug); suffix++) slug = `${base}-${suffix}`;
  taken.add(slug);
  return slug;
}

/** Headings a table of contents lists: levels 1 to 3, in document order. */
export function tocHeadings(doc: ProseMirrorNode): Array<{ level: number; text: string; pos: number }> {
  const headings: Array<{ level: number; text: string; pos: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const text = node.textContent.trim();
      if (text && (node.attrs.level as number) <= 3) headings.push({ level: node.attrs.level as number, text, pos });
      return false;
    }
    return true;
  });
  return headings;
}

/**
 * Fills the serialized table of contents with links to slugged heading ids,
 * and numbers footnote references with a footnotes list at the end, linked
 * both ways. Parsing ignores both, so HTML round-trips.
 */
function finishExport(container: HTMLElement): void {
  const target = container.ownerDocument;
  const tocs = container.querySelectorAll("nav[data-toc]");
  if (tocs.length) {
    const taken = new Set<string>();
    const entries = [...container.querySelectorAll<HTMLElement>("h1, h2, h3")]
      .filter((heading) => (heading.textContent ?? "").trim())
      .map((heading) => {
        heading.id = headingSlug(heading.textContent ?? "", taken);
        return { id: heading.id, level: Number(heading.tagName.slice(1)), text: (heading.textContent ?? "").trim() };
      });
    for (const nav of tocs) {
      const list = target.createElement("ol");
      for (const entry of entries) {
        const item = target.createElement("li");
        item.dataset.level = String(entry.level);
        const link = target.createElement("a");
        link.href = `#${entry.id}`;
        link.textContent = entry.text;
        item.append(link);
        list.append(item);
      }
      nav.replaceChildren(list);
    }
  }
  for (const table of container.querySelectorAll("table")) {
    const firstRow = table.querySelector("tr");
    if (!firstRow || !firstRow.querySelector("[data-colwidth]")) continue;
    const group = target.createElement("colgroup");
    for (const cell of firstRow.children) {
      const span = Math.max(1, Number(cell.getAttribute("colspan") ?? 1) || 1);
      const widths = (cell.getAttribute("data-colwidth") ?? "").split(",").map(Number);
      for (let index = 0; index < span; index++) {
        const col = target.createElement("col");
        const width = widths[index];
        if (width && Number.isFinite(width) && width > 0) col.setAttribute("style", `width: ${Math.round(width)}px`);
        group.append(col);
      }
    }
    table.prepend(group);
  }
  const references = container.querySelectorAll<HTMLElement>("sup[data-footnote]");
  if (references.length) {
    const section = target.createElement("section");
    section.dataset.footnotes = "";
    section.setAttribute("aria-label", "Footnotes");
    const list = target.createElement("ol");
    references.forEach((reference, index) => {
      const number = String(index + 1);
      reference.id = `fnref-${number}`;
      const link = target.createElement("a");
      link.href = `#fn-${number}`;
      link.textContent = number;
      reference.replaceChildren(link);
      const item = target.createElement("li");
      item.id = `fn-${number}`;
      const back = target.createElement("a");
      back.href = `#fnref-${number}`;
      back.setAttribute("aria-label", `Back to reference ${number}`);
      back.textContent = "↩";
      item.append(`${reference.dataset.footnote ?? ""} `, back);
      list.append(item);
    });
    section.append(list);
    container.append(section);
  }
}

/** Serializes a document to HTML; an empty document gives "". */
export function docToHtml(doc: ProseMirrorNode): string {
  if (typeof document === "undefined" || isEmptyDoc(doc)) return "";
  const target = document.implementation.createHTMLDocument("");
  const container = target.createElement("div");
  container.append(DOMSerializer.fromSchema(doc.type.schema).serializeFragment(doc.content, { document: target }));
  finishExport(container);
  return container.innerHTML;
}

/**
 * Styles for publishing HtmlEditor content: figures and captions, callouts,
 * columns that stack on phones, page breaks, the table of contents,
 * footnotes, table cells and tracked changes. Include it on the page that
 * shows the HTML; exports and printing embed it. Scope it by prefixing a
 * container selector if your site's CSS needs that.
 */
export const HTML_CONTENT_CSS = `figure{margin:1em 0}figure img{display:block;margin:0 auto;max-width:100%;height:auto}figure[data-align=left] img,figure[data-align=right] img{margin:0}figcaption{margin-top:.5em;font-size:.875em;color:#52525b;text-align:center}
aside[data-callout]{margin:1em 0;padding:.75em 1em;border-left:4px solid #2563eb;border-radius:6px;background:#eff6ff;color:#1e293b}aside[data-callout] > :first-child{margin-top:0}aside[data-callout] > :last-child{margin-bottom:0}
aside[data-callout=success]{border-color:#16a34a;background:#f0fdf4}aside[data-callout=warning]{border-color:#d97706;background:#fffbeb}aside[data-callout=danger]{border-color:#dc2626;background:#fef2f2}aside[data-callout=note]{border-color:#71717a;background:#f4f4f5}
div[data-columns]{margin:1em 0}div[data-column] > :first-child{margin-top:0}@media (max-width:640px){div[data-columns]{grid-template-columns:1fr !important}}
div[data-page-break]{break-after:page;page-break-after:always;height:0}@media screen{div[data-page-break]{margin:2em 0;border-top:1px dashed #a1a1aa}}
nav[data-toc]{margin:1em 0;padding:.75em 1em;border:1px solid #e4e4e7;border-radius:6px}nav[data-toc] ol{margin:0;padding-left:1.25em}nav[data-toc] li[data-level="2"]{margin-left:1em}nav[data-toc] li[data-level="3"]{margin-left:2em}
sup[data-footnote] a{text-decoration:none}section[data-footnotes]{margin-top:2em;padding-top:.75em;border-top:1px solid #e4e4e7;font-size:.875em}
td,th{border:1px solid #d4d4d8;padding:.4em .6em;vertical-align:top}table{border-collapse:collapse}
ins[data-change-id]{color:#166534;background:#dcfce7;text-decoration:underline}del[data-change-id]{color:#991b1b;background:#fee2e2;text-decoration:line-through}`;

/** Parses and re-serializes HTML through htmlSchema: what HtmlEditor would store for it. Needs a DOM. */
export function sanitizeHtml(html: string): string {
  return docToHtml(htmlToDoc(html));
}

/* ------------------------------------------------------------------ */
/* Formatting for the source view                                      */
/* ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "HR", "DIV", "FIGURE", "FIGCAPTION", "PRE", "IFRAME", "VIDEO", "COLGROUP", "COL"]);

function openTag(element: Element): string {
  const shell = element.cloneNode(false) as Element;
  const outer = shell.outerHTML;
  const close = `</${element.tagName.toLowerCase()}>`;
  return outer.endsWith(close) ? outer.slice(0, -close.length) : outer;
}

function formatNode(node: Node, depth: number, lines: string[]): void {
  const pad = "  ".repeat(depth);
  if (node.nodeType === 3) {
    const text = (node.textContent ?? "").trim();
    if (text) lines.push(pad + new XMLSerializer().serializeToString(node).trim());
    return;
  }
  if (node.nodeType !== 1) return;
  const element = node as Element;
  const blockChildren = [...element.childNodes].some((child) => child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName));
  if (element.tagName === "PRE" || !blockChildren) {
    lines.push(pad + element.outerHTML);
    return;
  }
  lines.push(pad + openTag(element));
  for (const child of element.childNodes) formatNode(child, depth + 1, lines);
  lines.push(`${pad}</${element.tagName.toLowerCase()}>`);
}

/** Puts block elements on their own indented lines for reading and editing. Inline content and <pre> stay as they are. */
export function formatHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const lines: string[] = [];
  for (const child of body.childNodes) {
    if (child.nodeType === 1 && !BLOCK_TAGS.has((child as Element).tagName)) lines.push((child as Element).outerHTML);
    else formatNode(child, 0, lines);
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Paste cleanup                                                       */
/* ------------------------------------------------------------------ */

export interface CleanPastedHtmlOptions {
  /**
   * Keeps font, size, text color and background color. Office defaults
   * (black text, white or transparent backgrounds, the body font and the
   * 11 and 12 point body sizes) are dropped either way.
   */
  keepStyles?: boolean;
}

/** HTML copied from Microsoft Word or Google Docs. */
export function isOfficeHtml(html: string): boolean {
  return /class="?Mso|urn:schemas-microsoft-com|<meta[^>]+(?:Word\.Document|Microsoft Word)|docs-internal-guid/i.test(html);
}

const OFFICE_FONTS = new Set(["calibri", "calibri light", "aptos", "aptos display", "arial", "times new roman", "cambria", "helvetica", "helvetica neue", "roboto", "symbol"]);
const OFFICE_SIZES = new Set(["11pt", "12pt", "11.0pt", "12.0pt"]);
const VISUAL = ["font-family", "font-size", "color", "background-color", "background"];

function isOfficeDefault(property: string, value: string): boolean {
  const text = value.trim().toLowerCase();
  if (property === "color") return /^(?:black|windowtext|auto|#000|#000000|rgb\(0,\s*0,\s*0\))$/.test(text);
  if (property === "background-color" || property === "background") return /^(?:transparent|white|window|auto|#fff|#ffffff|rgb\(255,\s*255,\s*255\))$/.test(text) || /rgba\([^)]*,\s*0\)$/.test(text);
  if (property === "font-family") return OFFICE_FONTS.has(primaryFontFamily(text));
  if (property === "font-size") return OFFICE_SIZES.has(text);
  return false;
}

function cleanStyle(element: HTMLElement, office: boolean, keepStyles: boolean): void {
  const style = element.getAttribute("style");
  if (style === null) return;
  const kept = style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon < 1) return false;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (property.startsWith("mso-")) return false;
      if (VISUAL.includes(property)) return keepStyles && !(office && isOfficeDefault(property, value));
      return true;
    });
  if (kept.length) element.setAttribute("style", kept.join("; "));
  else element.removeAttribute("style");
}

const ORDERED_MARKER = /^(?:\d+|[a-z]{1,3}|[ivxlcdm]+)[.)]/i;

/**
 * Rebuilds Word's list paragraphs (mso-list styles with typed bullet or
 * number glyphs) as nested <ul> and <ol> lists. A paragraph continues the
 * list right before it; a change of list, kind or a lower level closes the
 * deeper lists.
 */
function rebuildWordLists(root: HTMLElement): void {
  let stack: Array<{ level: number; list: HTMLElement; ordered: boolean; id: string }> = [];
  let rootList: HTMLElement | null = null;
  for (const paragraph of root.querySelectorAll<HTMLElement>("p[style*='mso-list']")) {
    const style = paragraph.getAttribute("style") ?? "";
    const level = Number(/level(\d+)/.exec(style)?.[1] ?? 1);
    const id = /mso-list:\s*(l\d+)/.exec(style)?.[1] ?? "l0";
    const markers = [...paragraph.querySelectorAll<HTMLElement>("[style]")].filter((element) => /mso-list:\s*ignore/i.test(element.getAttribute("style") ?? ""));
    const markerText = markers.map((element) => element.textContent ?? "").join("").replace(/\s/g, "");
    for (const marker of markers) marker.remove();
    const ordered = ORDERED_MARKER.test(markerText);
    if (rootList === null || paragraph.previousElementSibling !== rootList) stack = [];
    while (stack.length && (stack.at(-1)!.level > level || (stack.at(-1)!.level === level && (stack.at(-1)!.ordered !== ordered || stack.at(-1)!.id !== id)))) stack.pop();
    let top = stack.at(-1);
    if (!top || top.level < level) {
      const list = paragraph.ownerDocument.createElement(ordered ? "ol" : "ul");
      if (top) (top.list.lastElementChild ?? top.list).append(list);
      else {
        paragraph.before(list);
        rootList = list;
      }
      top = { level, list, ordered, id };
      stack.push(top);
    }
    const item = paragraph.ownerDocument.createElement("li");
    item.append(...paragraph.childNodes);
    top.list.append(item);
    paragraph.remove();
  }
}

/**
 * Cleans HTML pasted from Word, Google Docs or web pages before the editor
 * parses it: removes comments, styles, metadata, Word's empty spacer
 * paragraphs and mso- properties, turns Word list paragraphs into real
 * lists, and drops font, size and color unless `keepStyles` is set. HTML
 * copied from a ProseMirror editor keeps its styles.
 */
export function cleanPastedHtml(html: string, { keepStyles = false }: CleanPastedHtmlOptions = {}): string {
  if (typeof DOMParser === "undefined") return html;
  const office = isOfficeHtml(html);
  const fromEditor = /data-pm-slice/.test(html);
  const document = new DOMParser().parseFromString(html, "text/html");
  const body = document.body;
  for (const element of body.querySelectorAll("style, meta, link, title, script, xml, template")) element.remove();
  for (const element of body.querySelectorAll("*")) {
    if (element.tagName.includes(":")) element.replaceWith(...element.childNodes);
  }
  const comments: Node[] = [];
  const walker = document.createTreeWalker(body, 128);
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) comment.parentNode?.removeChild(comment);
  if (office) {
    for (const element of body.querySelectorAll<HTMLElement>("[style*='mso-hide:all'], [style*='display:none'], [style*='display: none']")) element.remove();
    rebuildWordLists(body);
    for (const paragraph of body.querySelectorAll<HTMLElement>("p")) {
      if (!paragraph.querySelector("img, br, iframe, video") && !(paragraph.textContent ?? "").replace(/\s/g, "")) paragraph.remove();
    }
  }
  if (!fromEditor) for (const element of body.querySelectorAll<HTMLElement>("[style]")) cleanStyle(element, office, keepStyles);
  liftCellBackgrounds(body);
  for (const element of body.querySelectorAll("[class]")) element.removeAttribute("class");
  return body.innerHTML;
}
