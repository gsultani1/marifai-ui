// src/lib/page-builder.ts
import type { ReactNode } from "react";
import { EMBED_IFRAME_ATTRS, embedFromUrl, type EmbedSource, safeCssColor, safeFontFamily, sanitizeHtml } from "./rich-text/html.js";
import { htmlToText } from "./html-text.js";
import { safeImageSrc, safeLinkHref } from "./safe-url.js";

export type BuilderAlign = "left" | "center" | "right";
export type BuilderMode = "email" | "page";
export type SocialNetwork = "facebook" | "instagram" | "x" | "linkedin" | "youtube" | "tiktok" | "website" | "email";

interface BlockBase {
  id: string;
  style?: BuilderBlockStyle;
  responsive?: Partial<Record<"tablet" | "mobile", BuilderBlockStyle>>;
}

export type BuilderBreakpoint = "desktop" | "tablet" | "mobile";
export type BuilderValue = string | number | boolean | null | BuilderValue[] | { [key: string]: BuilderValue };

export interface BuilderBlockStyle {
  padding?: number;
  marginTop?: number;
  marginBottom?: number;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  background?: string;
  align?: BuilderAlign;
  borderRadius?: number;
  widthPercent?: number;
}

export interface BuilderDesignToken {
  id: string;
  label: string;
  value: string;
}

export interface CustomBlock extends BlockBase {
  type: "custom";
  name: string;
  props: Record<string, BuilderValue>;
}

export interface BuilderBlockDefinition {
  type: string;
  label: string;
  create: () => Record<string, BuilderValue>;
  render: (block: CustomBlock) => ReactNode;
  renderToHtml: (block: CustomBlock) => string;
  renderInspector?: (block: CustomBlock, onChange: (props: CustomBlock["props"]) => void) => ReactNode;
  allowedParents?: readonly ("root" | "section" | "column")[];
  suggestions?: readonly string[];
}

export function createCustomBuilderBlock(definition: BuilderBlockDefinition): CustomBlock {
  return { id: newBuilderId("custom"), type: "custom", name: definition.type, props: structuredClone(definition.create()) };
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  align: BuilderAlign;
  /** Defaults to the document text color. */
  color?: string;
}

export interface TextBlock extends BlockBase {
  type: "text";
  /** Rich text from HtmlEditor; sanitized again whenever it is rendered. */
  html: string;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string;
  alt: string;
  href?: string;
  /** Percent of the available width, 10 to 100. */
  width: number;
  align: BuilderAlign;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  label: string;
  href: string;
  align: BuilderAlign;
  background: string;
  color: string;
  radius: number;
  fullWidth: boolean;
}

export interface DividerBlock extends BlockBase {
  type: "divider";
  color: string;
  thickness: number;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number;
}

export interface SocialLink {
  id: string;
  network: SocialNetwork;
  url: string;
}

export interface SocialBlock extends BlockBase {
  type: "social";
  links: SocialLink[];
  align: BuilderAlign;
}

export interface VideoBlock extends BlockBase {
  type: "video";
  /** YouTube, Vimeo or Loom link, or an https video file. */
  url: string;
  title: string;
}

export type LeafBlock = HeadingBlock | TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock | SocialBlock | VideoBlock | CustomBlock;

export interface BuilderColumn {
  id: string;
  blocks: LeafBlock[];
}

export interface ColumnsBlock extends BlockBase {
  type: "columns";
  columns: BuilderColumn[];
  gap: number;
}

export interface SectionBlock extends BlockBase {
  type: "section";
  background: string;
  padding: number;
  blocks: Array<LeafBlock | ColumnsBlock>;
}

export type BuilderBlock = LeafBlock | ColumnsBlock | SectionBlock;
export type BuilderBlockType = BuilderBlock["type"];

/** Changes to one block's own fields. */
export type BlockPatch<T extends BuilderBlock> = Partial<Omit<T, "id" | "type">>;
export type BuilderBlockPatch = BuilderBlock extends infer T ? (T extends BuilderBlock ? BlockPatch<T> : never) : never;

export interface BuilderSettings {
  /** Content width in pixels. */
  width: number;
  /** Behind the content. */
  background: string;
  contentBackground: string;
  fontFamily: string;
  textColor: string;
  linkColor: string;
  /** Left and right padding of top-level blocks, in pixels. */
  padding: number;
}

export interface BuilderDocument {
  title: string;
  /** Inbox preview text shown after the subject line (email only). */
  preheader: string;
  settings: BuilderSettings;
  blocks: BuilderBlock[];
}

/** Changes to the document's title, preview text or settings. */
export type BuilderDocumentPatch = Partial<Pick<BuilderDocument, "title" | "preheader">> & { settings?: Partial<BuilderSettings> };

/** Applies a document patch, merging settings. */
export function patchBuilderDocument(doc: BuilderDocument, patch: BuilderDocumentPatch): BuilderDocument {
  return { ...doc, ...patch, settings: { ...doc.settings, ...patch.settings } };
}

/** The id of the top-level container. Sections and columns are containers by their own ids. */
export const ROOT_CONTAINER = "root";

export const BUILDER_BLOCK_LABELS: Record<BuilderBlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  social: "Social links",
  video: "Video",
  columns: "Columns",
  section: "Section",
  custom: "Custom block",
};

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  website: "Website",
  email: "Email",
};

const LEAF_TYPES = new Set<BuilderBlockType>(["heading", "text", "image", "button", "divider", "spacer", "social", "video", "custom"]);
const clamp = (value: number, min: number, max: number) => (Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min);

export function isLeafBlock(block: BuilderBlock): block is LeafBlock {
  return LEAF_TYPES.has(block.type);
}

export function newBuilderId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Creation and normalization                                          */
/* ------------------------------------------------------------------ */

export function defaultBuilderSettings(mode: BuilderMode = "email"): BuilderSettings {
  return { width: mode === "email" ? 600 : 960, background: "#f4f4f5", contentBackground: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif", textColor: "#1f2937", linkColor: "#1d4ed8", padding: 24 };
}

export function createBuilderDocument(mode: BuilderMode = "email", blocks: BuilderBlock[] = []): BuilderDocument {
  return { title: mode === "email" ? "Email" : "Page", preheader: "", settings: defaultBuilderSettings(mode), blocks };
}

/** A new block of the type with sensible defaults. */
export function createBuilderBlock(type: BuilderBlockType): BuilderBlock {
  const id = newBuilderId(type);
  switch (type) {
    case "heading":
      return { id, type, text: "Heading", level: 2, align: "left" };
    case "text":
      return { id, type, html: "<p>Write something people will want to read.</p>" };
    case "image":
      return { id, type, src: "", alt: "", width: 100, align: "center" };
    case "button":
      return { id, type, label: "Shop now", href: "https://example.com", align: "center", background: "#1d4ed8", color: "#ffffff", radius: 6, fullWidth: false };
    case "divider":
      return { id, type, color: "#d4d4d8", thickness: 1 };
    case "spacer":
      return { id, type, height: 24 };
    case "social":
      return {
        id,
        type,
        align: "center",
        links: [
          { id: newBuilderId("link"), network: "facebook", url: "https://facebook.com/" },
          { id: newBuilderId("link"), network: "instagram", url: "https://instagram.com/" },
        ],
      };
    case "video":
      return { id, type, url: "", title: "" };
    case "columns":
      return { id, type, gap: 16, columns: [{ id: newBuilderId("column"), blocks: [] }, { id: newBuilderId("column"), blocks: [] }] };
    case "section":
      return { id, type, background: "#f8fafc", padding: 24, blocks: [] };
    case "custom":
      return { id, type, name: "custom", props: {} };
  }
}

/** A deep copy with fresh ids throughout, for duplicating. */
export function cloneBuilderBlock<T extends BuilderBlock>(block: T): T {
  const copy = structuredClone(block) as BuilderBlock;
  copy.id = newBuilderId(copy.type);
  if (copy.type === "columns") copy.columns = copy.columns.map((column) => ({ id: newBuilderId("column"), blocks: column.blocks.map((child) => cloneBuilderBlock(child)) }));
  if (copy.type === "section") copy.blocks = copy.blocks.map((child) => cloneBuilderBlock(child));
  if (copy.type === "social") copy.links = copy.links.map((link) => ({ ...link, id: newBuilderId("link") }));
  return copy as T;
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const text = (value: unknown, fallback = "", max = 5000) => (typeof value === "string" ? value.slice(0, max) : fallback);
const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const align = (value: unknown, fallback: BuilderAlign = "left"): BuilderAlign => (value === "left" || value === "center" || value === "right" ? value : fallback);
/** The normalized color, never the raw input: the color parser accepts trailing junk inside rgb() that must not reach CSS. */
const color = (value: unknown, fallback: string) => (typeof value === "string" && safeCssColor(value)) || fallback;
const id = (value: unknown, prefix: string) => (typeof value === "string" && /^[\w-]{1,64}$/.test(value) ? value : newBuilderId(prefix));

function normalizeBlockStyle(value: unknown): BuilderBlockStyle {
  const raw = record(value);
  const result: BuilderBlockStyle = {};
  for (const key of ["padding", "marginTop", "marginBottom", "fontSize", "borderRadius", "widthPercent"] as const) {
    if (typeof raw[key] === "number" && Number.isFinite(raw[key])) {
      result[key] = clamp(raw[key], key === "fontSize" ? 8 : 0, key === "widthPercent" ? 100 : 200);
    }
  }
  if (typeof raw.lineHeight === "number" && Number.isFinite(raw.lineHeight)) result.lineHeight = Math.min(3, Math.max(0.8, raw.lineHeight));
  for (const key of ["color", "background"] as const) {
    const parsed = typeof raw[key] === "string" ? safeCssColor(raw[key]) : null;
    if (parsed) result[key] = parsed;
  }
  if (raw.align === "left" || raw.align === "center" || raw.align === "right") result.align = raw.align;
  return result;
}

function normalizeBlockBase(raw: Record<string, unknown>): BlockBase {
  const base: BlockBase = { id: id(raw.id, String(raw.type ?? "block")) };
  if (raw.style) base.style = normalizeBlockStyle(raw.style);
  if (raw.responsive) {
    const responsive = record(raw.responsive);
    base.responsive = {};
    if (responsive.tablet) base.responsive.tablet = normalizeBlockStyle(responsive.tablet);
    if (responsive.mobile) base.responsive.mobile = normalizeBlockStyle(responsive.mobile);
  }
  return base;
}

function normalizeCustomValue(value: unknown, depth = 0): BuilderValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 100_000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (depth >= 8) return null;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => normalizeCustomValue(item, depth + 1));
  const entries = Object.entries(record(value)).filter(([key]) => !["__proto__", "prototype", "constructor"].includes(key)).slice(0, 100);
  return Object.fromEntries(entries.map(([key, item]) => [key, normalizeCustomValue(item, depth + 1)]));
}

/** Mobile inherits tablet values, which inherit the desktop values. */
export function resolveBuilderBlockStyle(block: BuilderBlock, breakpoint: BuilderBreakpoint = "desktop"): BuilderBlockStyle {
  return normalizeBlockStyle({
    ...block.style,
    ...(breakpoint !== "desktop" ? block.responsive?.tablet : {}),
    ...(breakpoint === "mobile" ? block.responsive?.mobile : {}),
  });
}

function normalizeLeaf(raw: Record<string, unknown>): LeafBlock | null {
  const base = normalizeBlockBase(raw);
  switch (raw.type) {
    case "heading":
      return { ...base, type: "heading", text: text(raw.text, "", 500), level: raw.level === 1 || raw.level === 3 ? raw.level : 2, align: align(raw.align), ...(typeof raw.color === "string" && safeCssColor(raw.color) ? { color: safeCssColor(raw.color)! } : {}) };
    case "text":
      return { ...base, type: "text", html: text(raw.html, "", 100_000) };
    case "image":
      return { ...base, type: "image", src: text(raw.src, "", 100_000), alt: text(raw.alt, "", 500), ...(typeof raw.href === "string" && raw.href ? { href: raw.href.slice(0, 2000) } : {}), width: clamp(num(raw.width, 100), 10, 100), align: align(raw.align, "center") };
    case "button":
      return { ...base, type: "button", label: text(raw.label, "Button", 200), href: text(raw.href, "", 2000), align: align(raw.align, "center"), background: color(raw.background, "#1d4ed8"), color: color(raw.color, "#ffffff"), radius: clamp(num(raw.radius, 6), 0, 40), fullWidth: raw.fullWidth === true };
    case "divider":
      return { ...base, type: "divider", color: color(raw.color, "#d4d4d8"), thickness: clamp(num(raw.thickness, 1), 1, 12) };
    case "spacer":
      return { ...base, type: "spacer", height: clamp(num(raw.height, 24), 4, 200) };
    case "social": {
      const links = (Array.isArray(raw.links) ? raw.links : [])
        .map(record)
        .filter((link) => typeof link.network === "string" && link.network in SOCIAL_LABELS)
        .slice(0, 12)
        .map((link) => ({ id: id(link.id, "link"), network: link.network as SocialNetwork, url: text(link.url, "", 2000) }));
      return { ...base, type: "social", links, align: align(raw.align, "center") };
    }
    case "video":
      return { ...base, type: "video", url: text(raw.url, "", 2000), title: text(raw.title, "", 300) };
    case "custom":
      return { ...base, type: "custom", name: text(raw.name, "custom", 100), props: normalizeCustomValue(record(raw.props)) as CustomBlock["props"] };
    default:
      return null;
  }
}

function normalizeBlock(value: unknown, depth: number): BuilderBlock | null {
  const raw = record(value);
  if (raw.type === "columns") {
    if (depth > 1) return null;
    const columns = (Array.isArray(raw.columns) ? raw.columns : [])
      .slice(0, 3)
      .map(record)
      .map((column) => ({ id: id(column.id, "column"), blocks: (Array.isArray(column.blocks) ? column.blocks : []).map((child) => normalizeLeaf(record(child))).filter((child): child is LeafBlock => child !== null) }));
    while (columns.length < 2) columns.push({ id: newBuilderId("column"), blocks: [] });
    return { ...normalizeBlockBase(raw), type: "columns", gap: clamp(num(raw.gap, 16), 0, 64), columns };
  }
  if (raw.type === "section") {
    if (depth > 0) return null;
    const blocks = (Array.isArray(raw.blocks) ? raw.blocks : []).map((child) => normalizeBlock(child, depth + 1)).filter((child): child is LeafBlock | ColumnsBlock => child !== null && child.type !== "section");
    return { ...normalizeBlockBase(raw), type: "section", background: color(raw.background, "#f8fafc"), padding: clamp(num(raw.padding, 24), 0, 96), blocks };
  }
  return normalizeLeaf(raw);
}

/**
 * Turns stored or imported JSON into a valid document: unknown block
 * types, sections inside sections and columns inside columns are dropped,
 * numbers are clamped and colors checked. Content is sanitized later, when
 * it is rendered.
 */
export function normalizeBuilderDocument(value: unknown, mode: BuilderMode = "email"): BuilderDocument {
  const raw = record(value);
  const defaults = defaultBuilderSettings(mode);
  const settings = record(raw.settings);
  return {
    title: text(raw.title, mode === "email" ? "Email" : "Page", 200),
    preheader: text(raw.preheader, "", 300),
    settings: {
      width: clamp(num(settings.width, defaults.width), 320, 1400),
      background: color(settings.background, defaults.background),
      contentBackground: color(settings.contentBackground, defaults.contentBackground),
      fontFamily: (typeof settings.fontFamily === "string" && safeFontFamily(settings.fontFamily)) || defaults.fontFamily,
      textColor: color(settings.textColor, defaults.textColor),
      linkColor: color(settings.linkColor, defaults.linkColor),
      padding: clamp(num(settings.padding, defaults.padding), 0, 96),
    },
    blocks: (Array.isArray(raw.blocks) ? raw.blocks : []).map((block) => normalizeBlock(block, 0)).filter((block): block is BuilderBlock => block !== null),
  };
}

/* ------------------------------------------------------------------ */
/* Tree operations                                                     */
/* ------------------------------------------------------------------ */

export interface BuilderLocation {
  block: BuilderBlock;
  containerId: string;
  index: number;
  /** Nesting depth of the container: 0 for root, 1 inside a section or columns, 2 for columns in a section. */
  depth: number;
}

type Container = { id: string; blocks: BuilderBlock[]; kind: "root" | "section" | "column"; depth: number };

function containers(doc: BuilderDocument): Container[] {
  const list: Container[] = [{ id: ROOT_CONTAINER, blocks: doc.blocks, kind: "root", depth: 0 }];
  const visit = (blocks: BuilderBlock[], depth: number) => {
    for (const block of blocks) {
      if (block.type === "section") {
        list.push({ id: block.id, blocks: block.blocks, kind: "section", depth: depth + 1 });
        visit(block.blocks, depth + 1);
      } else if (block.type === "columns") {
        for (const column of block.columns) list.push({ id: column.id, blocks: column.blocks, kind: "column", depth: depth + 1 });
      }
    }
  };
  visit(doc.blocks, 0);
  return list;
}

export function findBuilderBlock(doc: BuilderDocument, blockId: string): BuilderLocation | null {
  for (const container of containers(doc)) {
    const index = container.blocks.findIndex((block) => block.id === blockId);
    if (index >= 0) return { block: container.blocks[index]!, containerId: container.id, index, depth: container.depth };
  }
  return null;
}

/** The blocks directly inside a container, or an empty list for an unknown id. */
export function blocksIn(doc: BuilderDocument, containerId: string): BuilderBlock[] {
  return containers(doc).find((item) => item.id === containerId)?.blocks ?? [];
}

function containsBlock(block: BuilderBlock, blockId: string): boolean {
  if (block.id === blockId) return true;
  if (block.type === "section") return block.blocks.some((child) => containsBlock(child, blockId));
  if (block.type === "columns") return block.columns.some((column) => column.blocks.some((child) => containsBlock(child, blockId)));
  return false;
}

/** Index of the top-level block that is or contains the block, or -1. */
export function rootIndexOf(doc: BuilderDocument, blockId: string): number {
  return doc.blocks.findIndex((block) => containsBlock(block, blockId));
}

/** The columns block that owns a column. */
export function columnsOwning(doc: BuilderDocument, columnId: string): ColumnsBlock | null {
  for (const block of [...doc.blocks, ...doc.blocks.flatMap((item) => (item.type === "section" ? item.blocks : []))]) {
    if (block.type === "columns" && block.columns.some((column) => column.id === columnId)) return block;
  }
  return null;
}

/** Whether a block of this type may go in the container: sections only at the top level, columns not inside columns. */
export function canContain(doc: BuilderDocument, containerId: string, type: BuilderBlockType, definition?: BuilderBlockDefinition): boolean {
  const container = containers(doc).find((item) => item.id === containerId);
  if (!container) return false;
  if (definition?.allowedParents && !definition.allowedParents.includes(container.kind)) return false;
  if (container.kind === "root") return true;
  if (container.kind === "section") return type !== "section";
  return LEAF_TYPES.has(type);
}

function mapContainer(doc: BuilderDocument, containerId: string, update: (blocks: BuilderBlock[]) => BuilderBlock[]): BuilderDocument {
  if (containerId === ROOT_CONTAINER) return { ...doc, blocks: update(doc.blocks) };
  const visit = (blocks: BuilderBlock[]): BuilderBlock[] =>
    blocks.map((block) => {
      if (block.type === "section") return block.id === containerId ? { ...block, blocks: update(block.blocks) as SectionBlock["blocks"] } : { ...block, blocks: visit(block.blocks) as SectionBlock["blocks"] };
      if (block.type === "columns") return { ...block, columns: block.columns.map((column) => (column.id === containerId ? { ...column, blocks: update(column.blocks) as LeafBlock[] } : column)) };
      return block;
    });
  return { ...doc, blocks: visit(doc.blocks) };
}

export function insertBuilderBlock(doc: BuilderDocument, block: BuilderBlock, containerId: string, index: number, registry?: readonly BuilderBlockDefinition[]): BuilderDocument {
  const definition = block.type === "custom" ? registry?.find((entry) => entry.type === block.name) : undefined;
  if (!canContain(doc, containerId, block.type, definition)) return doc;
  return mapContainer(doc, containerId, (blocks) => {
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    return next;
  });
}

export function removeBuilderBlock(doc: BuilderDocument, blockId: string): BuilderDocument {
  const location = findBuilderBlock(doc, blockId);
  return location ? mapContainer(doc, location.containerId, (blocks) => blocks.filter((block) => block.id !== blockId)) : doc;
}

export function updateBuilderBlock(doc: BuilderDocument, blockId: string, patch: BuilderBlockPatch): BuilderDocument {
  const location = findBuilderBlock(doc, blockId);
  return location ? mapContainer(doc, location.containerId, (blocks) => blocks.map((block) => (block.id === blockId ? ({ ...block, ...patch } as BuilderBlock) : block))) : doc;
}

/** Moves a block to an index in a container; the index counts positions before the move. The nesting rules rule out moving a block into itself. */
export function moveBuilderBlock(doc: BuilderDocument, blockId: string, containerId: string, index: number, registry?: readonly BuilderBlockDefinition[]): BuilderDocument {
  const location = findBuilderBlock(doc, blockId);
  if (!location) return doc;
  const block = location.block;
  const definition = block.type === "custom" ? registry?.find((entry) => entry.type === block.name) : undefined;
  if (!canContain(doc, containerId, location.block.type, definition)) return doc;
  const target = location.containerId === containerId && index > location.index ? index - 1 : index;
  if (location.containerId === containerId && target === location.index) return doc;
  return insertBuilderBlock(removeBuilderBlock(doc, blockId), location.block, containerId, target, registry);
}

/** Moves a block one step up or down within its container. */
export function nudgeBuilderBlock(doc: BuilderDocument, blockId: string, delta: -1 | 1): BuilderDocument {
  const location = findBuilderBlock(doc, blockId);
  if (!location) return doc;
  if ((delta < 0 && location.index === 0) || (delta > 0 && location.index >= blocksIn(doc, location.containerId).length - 1)) return doc;
  return moveBuilderBlock(doc, blockId, location.containerId, location.index + (delta > 0 ? 2 : -1));
}

export function duplicateBuilderBlock(doc: BuilderDocument, blockId: string): { doc: BuilderDocument; id: string | null } {
  const location = findBuilderBlock(doc, blockId);
  if (!location) return { doc, id: null };
  const copy = cloneBuilderBlock(location.block);
  return { doc: insertBuilderBlock(doc, copy, location.containerId, location.index + 1), id: copy.id };
}

/** Changes a columns block to 2 or 3 columns; blocks from a removed column move into the last remaining one. */
export function setColumnCount(block: ColumnsBlock, count: number): ColumnsBlock {
  const target = clamp(count, 2, 3);
  if (target === block.columns.length) return block;
  if (target > block.columns.length) return { ...block, columns: [...block.columns, ...Array.from({ length: target - block.columns.length }, () => ({ id: newBuilderId("column"), blocks: [] }))] };
  const kept = block.columns.slice(0, target);
  const moved = block.columns.slice(target).flatMap((column) => column.blocks);
  kept[target - 1] = { ...kept[target - 1]!, blocks: [...kept[target - 1]!.blocks, ...moved] };
  return { ...block, columns: kept };
}

/** A short description such as "Heading: Spring sale", used as the block's accessible name. */
export function builderBlockLabel(block: BuilderBlock): string {
  const name = BUILDER_BLOCK_LABELS[block.type];
  const snippet = (value: string) => {
    const clean = value.replace(/\s+/g, " ").trim();
    return clean.length > 48 ? `${clean.slice(0, 47)}…` : clean;
  };
  switch (block.type) {
    case "heading":
      return `${name}: ${snippet(block.text) || "empty"}`;
    case "text":
      return `${name}: ${snippet(htmlToText(block.html)) || "empty"}`;
    case "image":
      return `${name}: ${block.alt || (block.src ? "no description" : "not set")}`;
    case "button":
      return `${name}: ${snippet(block.label)}`;
    case "video":
      return `${name}: ${snippet(block.title || block.url) || "not set"}`;
    case "columns":
      return `${block.columns.length} ${name.toLowerCase()}`;
    case "section":
      return `${name}, ${block.blocks.length} ${block.blocks.length === 1 ? "block" : "blocks"}`;
    case "custom":
      return `Custom: ${snippet(block.name)}`;
    default:
      return name;
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

export type BuilderTarget = "web" | "email";

export interface BuilderRenderContext {
  target: BuilderTarget;
  settings: BuilderSettings;
  /** Width the block can use, in pixels, for image sizing. */
  available: number;
  /** Renders placeholders for empty images and videos and a stand-in instead of live players. */
  editing?: boolean;
  registry?: readonly BuilderBlockDefinition[];
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

const css = (declarations: Record<string, string | number | undefined | false>) =>
  Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== false && value !== "")
    .map(([property, value]) => `${property}:${value}`)
    .join(";");

const safeColor = (value: string | undefined, fallback: string) => (value && safeCssColor(value)) || fallback;
const HEADING_SIZES = { 1: 30, 2: 24, 3: 19 } as const;

const TEXT_DEFAULTS: Record<string, Record<string, string>> = {
  p: { margin: "0 0 12px 0" },
  h1: { margin: "0 0 12px 0", "font-size": "28px", "line-height": "1.25" },
  h2: { margin: "0 0 10px 0", "font-size": "22px", "line-height": "1.3" },
  h3: { margin: "0 0 8px 0", "font-size": "18px", "line-height": "1.3" },
  h4: { margin: "0 0 8px 0", "font-size": "16px" },
  ul: { margin: "0 0 12px 0", "padding-left": "24px" },
  ol: { margin: "0 0 12px 0", "padding-left": "24px" },
  li: { margin: "0 0 4px 0" },
  blockquote: { margin: "0 0 12px 0", "padding-left": "12px", "border-left": "3px solid #d4d4d8", color: "#52525b" },
  img: { "max-width": "100%", height: "auto" },
  table: { "border-collapse": "collapse", width: "100%" },
  td: { border: "1px solid #d4d4d8", padding: "4px 8px" },
  th: { border: "1px solid #d4d4d8", padding: "4px 8px", "text-align": "left" },
  pre: { margin: "0 0 12px 0", padding: "12px", background: "#f4f4f5", "white-space": "pre-wrap" },
};

const textCache = new Map<string, string>();

/**
 * Sanitizes a text block's HTML and writes default spacing, link color and
 * list indents onto its elements as inline styles, because many email
 * clients drop <style> rules. Existing inline styles win. Video embeds are
 * dropped; the Video block handles video.
 */
export function inlineTextHtml(html: string, linkColor: string): string {
  const key = `${linkColor}\u0000${html}`;
  const cached = textCache.get(key);
  if (cached !== undefined) return cached;
  const clean = sanitizeHtml(html);
  let result = clean;
  if (clean && typeof DOMParser !== "undefined") {
    const body = new DOMParser().parseFromString(clean, "text/html").body;
    for (const embed of body.querySelectorAll("[data-embed]")) embed.remove();
    const defaults: Record<string, Record<string, string>> = { ...TEXT_DEFAULTS, a: { color: linkColor, "text-decoration": "underline" } };
    for (const element of body.querySelectorAll<HTMLElement>("*")) {
      const rules = defaults[element.tagName.toLowerCase()];
      if (!rules) continue;
      for (const [property, value] of Object.entries(rules)) if (!element.style.getPropertyValue(property)) element.style.setProperty(property, value);
    }
    const last = body.lastElementChild as HTMLElement | null;
    last?.style.setProperty("margin-bottom", "0");
    result = body.innerHTML;
  }
  if (textCache.size > 500) textCache.clear();
  textCache.set(key, result);
  return result;
}

function placeholder(label: string, height: number): string {
  return `<div style="${css({ height: `${height}px`, display: "flex", "align-items": "center", "justify-content": "center", border: "2px dashed #a1a1aa", "border-radius": "8px", color: "#52525b", "font-size": "14px", background: "#fafafa" })}">${escapeHtml(label)}</div>`;
}

const marginFor = (value: BuilderAlign) => (value === "center" ? "0 auto" : value === "right" ? "0 0 0 auto" : "0");

/** The table wrapper email clients need around a block that must keep its alignment. */
function emailAligned(value: BuilderAlign, inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${value}">${inner}</td></tr></table>`;
}

/** The page to open for an embed, for email where players cannot run, and the YouTube id when there is one. */
function watchLink(embed: EmbedSource): { href: string; youTubeId: string | null } {
  const url = new URL(embed.src);
  if (embed.provider === "YouTube") {
    const youTubeId = url.pathname.split("/").pop() ?? "";
    const start = url.searchParams.get("start");
    return { href: `https://www.youtube.com/watch?v=${youTubeId}${start ? `&t=${start}s` : ""}`, youTubeId };
  }
  if (embed.provider === "Vimeo") {
    const hash = url.searchParams.get("h");
    return { href: `https://vimeo.com/${url.pathname.split("/").pop() ?? ""}${hash ? `/${hash}` : ""}`, youTubeId: null };
  }
  if (embed.provider === "Loom") return { href: embed.src.replace("/embed/", "/share/"), youTubeId: null };
  return { href: embed.src, youTubeId: null };
}

/** HTML for one content block in the target, with every value escaped, checked or sanitized. */
export function renderLeafHtml(block: LeafBlock, context: BuilderRenderContext): string {
  const { settings, target, editing = false } = context;
  const link = safeColor(settings.linkColor, "#1d4ed8");
  switch (block.type) {
    case "custom": {
      const definition = context.registry?.find((entry) => entry.type === block.name);
      return definition ? sanitizeHtml(definition.renderToHtml(block)) : placeholder(`Unavailable block: ${block.name}`, 64);
    }
    case "heading": {
      const style = css({ margin: "0", "font-size": `${HEADING_SIZES[block.level]}px`, "line-height": "1.25", "font-weight": "700", "text-align": block.align, color: safeColor(block.color, safeColor(settings.textColor, "#1f2937")) });
      return `<h${block.level} style="${style}">${escapeHtml(block.text)}</h${block.level}>`;
    }
    case "text":
      return `<div style="${css({ "font-size": "16px", "line-height": "1.6" })}">${inlineTextHtml(block.html, link)}</div>`;
    case "image": {
      const src = safeImageSrc(block.src);
      if (!src) return editing ? placeholder("Add an image in the block settings", 160) : "";
      const px = Math.max(16, Math.round((context.available * clamp(block.width, 10, 100)) / 100));
      const image = `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" width="${px}" style="${css({ display: "block", width: "100%", "max-width": `${px}px`, height: "auto", border: "0", margin: marginFor(block.align) })}">`;
      const href = block.href ? safeLinkHref(block.href) : undefined;
      return href ? `<a href="${escapeHtml(href)}" style="display:block">${image}</a>` : image;
    }
    case "button": {
      const href = safeLinkHref(block.href) ?? "#";
      const background = safeColor(block.background, "#1d4ed8");
      const foreground = safeColor(block.color, "#ffffff");
      const radius = clamp(block.radius, 0, 40);
      const anchor = `<a href="${escapeHtml(href)}" style="${css({ display: block.fullWidth ? "block" : "inline-block", padding: "12px 24px", background, color: foreground, "border-radius": `${radius}px`, "font-weight": "600", "font-size": "16px", "line-height": "1.2", "text-decoration": "none", "text-align": "center" })}">${escapeHtml(block.label)}</a>`;
      if (target === "web") return `<div style="${css({ "text-align": block.align })}">${anchor}</div>`;
      const cell = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${block.fullWidth ? ' width="100%"' : ""}><tr><td bgcolor="${background}" style="${css({ background, "border-radius": `${radius}px`, "text-align": "center" })}">${anchor}</td></tr></table>`;
      return emailAligned(block.align, cell);
    }
    case "divider":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${css({ "border-top": `${clamp(block.thickness, 1, 12)}px solid ${safeColor(block.color, "#d4d4d8")}`, "font-size": "0", "line-height": "0", height: "1px" })}">&nbsp;</td></tr></table>`;
    case "spacer": {
      const height = clamp(block.height, 4, 200);
      return `<div style="${css({ height: `${height}px`, "line-height": `${height}px`, "font-size": "0" })}">&nbsp;</div>`;
    }
    case "social": {
      const links = block.links
        .map((item) => {
          const href = item.network === "email" ? safeLinkHref(item.url.startsWith("mailto:") ? item.url : `mailto:${item.url}`) : safeLinkHref(item.url);
          return href ? `<a href="${escapeHtml(href)}" style="${css({ color: link, "font-weight": "600", "text-decoration": "none" })}">${escapeHtml(SOCIAL_LABELS[item.network])}</a>` : "";
        })
        .filter(Boolean);
      if (!links.length) return editing ? placeholder("Add social links in the block settings", 48) : "";
      return `<p style="${css({ margin: "0", "text-align": block.align, "font-size": "15px" })}">${links.join(' <span aria-hidden="true">&middot;</span> ')}</p>`;
    }
    case "video": {
      const embed = embedFromUrl(block.url);
      const title = block.title || (embed ? `${embed.provider} video` : "Video");
      if (!embed) return editing ? placeholder("Add a YouTube, Vimeo or Loom link in the block settings", 160) : "";
      if (editing) {
        return `<div style="${css({ "aspect-ratio": "16 / 9", display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", gap: "6px", background: "#18181b", color: "#fafafa", "border-radius": "8px", "font-size": "14px" })}"><span aria-hidden="true" style="font-size:28px">&#9654;</span><span>${escapeHtml(title)}</span></div>`;
      }
      if (target === "web") {
        if (embed.kind === "video") return `<video src="${escapeHtml(embed.src)}" controls preload="metadata" title="${escapeHtml(title)}" style="width:100%;display:block"></video>`;
        const attrs = Object.entries(EMBED_IFRAME_ATTRS)
          .map(([name, value]) => (value === "" ? name : `${name}="${escapeHtml(value)}"`))
          .join(" ");
        return `<iframe src="${escapeHtml(embed.src)}" title="${escapeHtml(title)}" ${attrs}></iframe>`;
      }
      const { href, youTubeId } = watchLink(embed);
      if (youTubeId) {
        const thumb = `https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`;
        return `<a href="${escapeHtml(href)}" style="display:block"><img src="${thumb}" alt="${escapeHtml(`Play: ${title}`)}" width="${context.available}" style="${css({ display: "block", width: "100%", "max-width": `${context.available}px`, height: "auto", border: "0" })}"></a>`;
      }
      return `<p style="margin:0;text-align:center"><a href="${escapeHtml(href)}" style="${css({ color: link, "font-weight": "600" })}">Watch: ${escapeHtml(title)}</a></p>`;
    }
  }
}

const leafCache = new WeakMap<LeafBlock, Map<string, string>>();

/** renderLeafHtml with a per-block cache, for the editing canvas. */
export function cachedLeafHtml(block: LeafBlock, context: BuilderRenderContext): string {
  if (block.type === "custom") return renderLeafHtml(block, context);
  const { settings } = context;
  const key = [context.target, context.available, context.editing ? 1 : 0, settings.linkColor, settings.textColor].join("|");
  let entries = leafCache.get(block);
  if (!entries) {
    entries = new Map();
    leafCache.set(block, entries);
  }
  const hit = entries.get(key);
  if (hit !== undefined) return hit;
  const html = renderLeafHtml(block, context);
  entries.set(key, html);
  return html;
}

/** Vertical padding around every content block, in pixels. */
export const BLOCK_PADDING = 10;

/** Shared by the editing canvas and generated HTML. */
export function builderBlockClass(block: BuilderBlock): string {
  return `pb-style-${block.id.replace(/[^\w-]/g, "")}`;
}

function blockStyleRules(block: BuilderBlock, style: BuilderBlockStyle): string {
  const selector = `.${builderBlockClass(block)}`;
  const normalized = normalizeBlockStyle(style);
  const pixel = (value: number | undefined) => value === undefined ? undefined : `${value}px`;
  const box = css({
    padding: pixel(normalized.padding),
    "margin-top": pixel(normalized.marginTop),
    "margin-bottom": pixel(normalized.marginBottom),
    background: normalized.background,
    "border-radius": pixel(normalized.borderRadius),
    width: normalized.widthPercent === undefined ? undefined : `${normalized.widthPercent}%`,
  });
  const typography = css({ "font-size": pixel(normalized.fontSize), "line-height": normalized.lineHeight, color: normalized.color, "text-align": normalized.align });
  const important = (rules: string) => rules.replace(/(;|$)/g, "!important$1");
  const canvasPadding = normalized.padding === undefined ? "" : `${selector}.pb-builder-frame>div:not([data-builder-actions]){padding:0!important}`;
  return `${box ? `${selector}{${important(box)}}` : ""}${canvasPadding}${typography ? `${selector},${selector}>div,${selector}>h1,${selector}>h2,${selector}>h3,${selector}>div>:is(h1,h2,h3,p,a){${important(typography)}}` : ""}`;
}

/** Desktop styles plus tablet (768px) and mobile (480px) overrides. A selected breakpoint renders the same cascade on the canvas. */
export function builderResponsiveCss(doc: BuilderDocument, breakpoint?: BuilderBreakpoint): string {
  const blocks = containers(doc).flatMap((container) => container.blocks);
  return blocks.map((block) => {
    if (breakpoint) return blockStyleRules(block, resolveBuilderBlockStyle(block, breakpoint));
    const desktop = blockStyleRules(block, block.style ?? {});
    const tablet = block.responsive?.tablet ? `@media(max-width:768px){${blockStyleRules(block, block.responsive.tablet)}}` : "";
    const mobile = block.responsive?.mobile ? `@media(max-width:480px){${blockStyleRules(block, block.responsive.mobile)}}` : "";
    return desktop + tablet + mobile;
  }).join("");
}

function renderWebBlocks(blocks: BuilderBlock[], context: BuilderRenderContext, inset: number): string {
  return blocks
    .map((block) => {
      if (block.type === "section") {
        const padding = clamp(block.padding, 0, 96);
        const inner = renderWebBlocks(block.blocks, { ...context, available: context.available - padding * 2 }, 0);
        return `<div${block.style || block.responsive ? ` class="${builderBlockClass(block)}"` : ""} style="${css({ background: safeColor(block.background, "transparent"), padding: `${padding}px` })}">${inner}</div>`;
      }
      if (block.type === "columns") {
        const gap = clamp(block.gap, 0, 64);
        const width = Math.floor((context.available - inset * 2 - gap * (block.columns.length - 1)) / block.columns.length);
        const columns = block.columns.map((column) => `<div class="pb-col" style="flex:1 1 0;min-width:0">${renderWebBlocks(column.blocks, { ...context, available: width }, 0)}</div>`).join("");
        return `<div class="pb-cols${block.style || block.responsive ? ` ${builderBlockClass(block)}` : ""}" style="${css({ display: "flex", gap: `${gap}px`, padding: `0 ${inset}px` })}">${columns}</div>`;
      }
      const html = renderLeafHtml(block, { ...context, available: context.available - inset * 2 });
      return html ? `<div${block.style || block.responsive ? ` class="${builderBlockClass(block)}"` : ""} style="${css({ padding: `${BLOCK_PADDING}px ${inset}px` })}">${html}</div>` : "";
    })
    .join("");
}

function renderEmailRows(blocks: BuilderBlock[], context: BuilderRenderContext, inset: number): string {
  return blocks
    .map((block) => {
      if (block.type === "section") {
        const padding = clamp(block.padding, 0, 96);
        const background = safeColor(block.background, "transparent");
        const inner = renderEmailRows(block.blocks, { ...context, available: context.available - padding * 2 }, 0);
        return `<tr><td bgcolor="${background}" style="${css({ background, padding: `${padding}px` })}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table></td></tr>`;
      }
      if (block.type === "columns") {
        const gap = clamp(block.gap, 0, 64);
        const share = Math.floor(100 / block.columns.length);
        const width = Math.floor((context.available - inset * 2 - gap * (block.columns.length - 1)) / block.columns.length);
        const cells = block.columns
          .map((column, index) => {
            const padding = `0 ${index === block.columns.length - 1 ? 0 : Math.ceil(gap / 2)}px 0 ${index === 0 ? 0 : Math.floor(gap / 2)}px`;
            return `<td class="pb-col" width="${share}%" valign="top" style="${css({ width: `${share}%`, padding })}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${renderEmailRows(column.blocks, { ...context, available: width }, 0)}</table></td>`;
          })
          .join("");
        return `<tr><td style="${css({ padding: `0 ${inset}px` })}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`;
      }
      const html = renderLeafHtml(block, { ...context, available: context.available - inset * 2 });
      return html ? `<tr><td style="${css({ padding: `${BLOCK_PADDING}px ${inset}px` })}">${html}</td></tr>` : "";
    })
    .join("");
}

export interface BuilderHtmlOptions {
  /** "email" builds table layout with inline styles for mail clients; "web" builds a responsive page. */
  target?: BuilderTarget;
  /** Page language for the lang attribute. */
  lang?: string;
  registry?: readonly BuilderBlockDefinition[];
}

/** A complete HTML document for the design. Text blocks are sanitized; needs a DOM for that, as in the browser. */
export function builderToHtml(design: BuilderDocument, { target = "email", lang = "en", registry }: BuilderHtmlOptions = {}): string {
  const doc = normalizeBuilderDocument(design);
  const { settings } = doc;
  const font = safeFontFamily(settings.fontFamily) ?? "Arial, sans-serif";
  const context: BuilderRenderContext = { target, settings, available: settings.width, ...(registry ? { registry } : {}) };
  const title = escapeHtml(doc.title);
  const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(lang) ? lang : "en";
  if (target === "web") {
    const style = `body{margin:0;background:${settings.background}}.pb-page{max-width:${settings.width}px;margin:0 auto;background:${settings.contentBackground};font-family:${font};color:${settings.textColor};padding:${BLOCK_PADDING * 2}px 0}img,video,iframe{max-width:100%}@media (max-width:${Math.min(settings.width, 720)}px){.pb-cols{flex-direction:column}}`;
    return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${style}${builderResponsiveCss(doc)}</style></head><body><main class="pb-page">${renderWebBlocks(doc.blocks, context, settings.padding)}</main></body></html>`;
  }
  const style = `body{margin:0;padding:0;width:100%!important}table{border-collapse:collapse}img{border:0;outline:none;text-decoration:none}@media only screen and (max-width:${settings.width + 20}px){.pb-container{width:100%!important}.pb-col{display:block!important;width:100%!important;padding:0!important}}`;
  const preheader = doc.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(doc.preheader)}</div>` : "";
  return [
    `<!doctype html><html lang="${language}" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><title>${title}</title><style>${style}</style></head>`,
    `<body style="${css({ margin: "0", padding: "0", background: settings.background })}">${preheader}`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${settings.background}" style="background:${settings.background}"><tr><td align="center" style="padding:24px 12px">`,
    `<!--[if mso]><table role="presentation" width="${settings.width}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`,
    `<table role="presentation" class="pb-container" width="${settings.width}" cellpadding="0" cellspacing="0" border="0" bgcolor="${settings.contentBackground}" style="${css({ width: "100%", "max-width": `${settings.width}px`, background: settings.contentBackground, "font-family": font, color: settings.textColor })}">`,
    `<tr><td style="height:${BLOCK_PADDING}px;font-size:0;line-height:0">&nbsp;</td></tr>${renderEmailRows(doc.blocks, context, settings.padding)}<tr><td style="height:${BLOCK_PADDING}px;font-size:0;line-height:0">&nbsp;</td></tr>`,
    "</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>",
  ].join("");
}
