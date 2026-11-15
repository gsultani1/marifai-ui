// packages/ai-ui/src/lib/rich-text/markdown.ts
import type { Definition, Nodes as MdNode, PhrasingContent, Root, RootContent, Table } from "mdast";
import type { Mark, Node as ProseMirrorNode, Schema } from "prosemirror-model";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { richTextSchema, safeImageSrc, safeLinkHref } from "./schema.js";

const parser = unified().use(remarkParse).use(remarkGfm);

interface Context {
  schema: Schema;
  definitions: Map<string, Definition>;
}

const HTML_MARKS: Record<string, string> = { u: "underline", ins: "underline", mark: "highlight", sub: "subscript", sup: "superscript" };

function inline(nodes: PhrasingContent[], outer: readonly Mark[], context: Context): ProseMirrorNode[] {
  const { schema } = context;
  const out: ProseMirrorNode[] = [];
  const open = new Map<string, number>();
  let marks: readonly Mark[] = outer;
  const refresh = () => {
    marks = [...open.keys()].reduce<readonly Mark[]>((set, name) => schema.marks[name]!.create().addToSet(set), outer);
  };
  const withMark = (children: PhrasingContent[], mark: Mark | null) => out.push(...inline(children, mark ? mark.addToSet(marks) : marks, context));
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        if (node.value) out.push(schema.text(node.value, marks));
        break;
      case "strong":
        withMark(node.children, schema.marks.strong!.create());
        break;
      case "emphasis":
        withMark(node.children, schema.marks.em!.create());
        break;
      case "delete":
        withMark(node.children, schema.marks.strike!.create());
        break;
      case "inlineCode":
        if (node.value) out.push(schema.text(node.value, schema.marks.code!.create().addToSet(marks.filter((mark) => mark.type.name === "link"))));
        break;
      case "break":
        out.push(schema.nodes.hard_break!.create());
        break;
      case "link":
      case "linkReference": {
        const url = node.type === "link" ? node.url : context.definitions.get(node.identifier.toLowerCase())?.url;
        const href = safeLinkHref(url);
        withMark(node.children, href ? schema.marks.link!.create({ href, title: node.type === "link" ? (node.title ?? null) : null }) : null);
        break;
      }
      case "image":
      case "imageReference": {
        const url = node.type === "image" ? node.url : context.definitions.get(node.identifier.toLowerCase())?.url;
        const src = safeImageSrc(url);
        if (src) out.push(schema.nodes.image!.create({ src, alt: node.alt ?? "", title: node.type === "image" ? (node.title ?? null) : null }));
        else if (node.alt) out.push(schema.text(node.alt, marks));
        break;
      }
      case "html": {
        const tag = /^<(\/?)(u|ins|mark|sub|sup|br\s*\/?)>$/i.exec(node.value.trim());
        const name = tag?.[2]?.toLowerCase();
        if (name?.startsWith("br")) {
          out.push(schema.nodes.hard_break!.create());
        } else if (tag && name && HTML_MARKS[name]) {
          const markName = HTML_MARKS[name]!;
          if (tag[1]) {
            const depth = (open.get(markName) ?? 1) - 1;
            if (depth <= 0) open.delete(markName);
            else open.set(markName, depth);
          } else {
            open.set(markName, (open.get(markName) ?? 0) + 1);
          }
          refresh();
        } else if (node.value) {
          out.push(schema.text(node.value, marks));
        }
        break;
      }
      case "footnoteReference":
        out.push(schema.text(`[^${node.identifier}]`, marks));
        break;
      default: {
        const other = node as { children?: PhrasingContent[]; value?: unknown };
        if (other.children) withMark(other.children, null);
        else if (typeof other.value === "string" && other.value) out.push(schema.text(other.value, marks));
      }
    }
  }
  return out;
}

function paragraph(children: PhrasingContent[], context: Context): ProseMirrorNode {
  return context.schema.nodes.paragraph!.create(null, inline(children, [], context));
}

function listItems(node: Extract<RootContent, { type: "list" }>, context: Context): ProseMirrorNode {
  const { schema } = context;
  const task = node.children.some((item) => typeof item.checked === "boolean");
  const itemType = task ? schema.nodes.task_item! : schema.nodes.list_item!;
  const items = node.children.map((item) => {
    const content = blocks(item.children as RootContent[], context);
    if (content[0]?.type !== schema.nodes.paragraph) content.unshift(schema.nodes.paragraph!.create());
    return itemType.create(task ? { checked: item.checked === true } : null, content);
  });
  if (task) return schema.nodes.task_list!.create(null, items);
  return node.ordered ? schema.nodes.ordered_list!.create({ order: node.start ?? 1 }, items) : schema.nodes.bullet_list!.create(null, items);
}

function table(node: Table, context: Context): ProseMirrorNode {
  const { schema } = context;
  const width = Math.max(1, ...node.children.map((row) => row.children.length));
  const rows = node.children.map((row, index) => {
    const cellType = index === 0 ? schema.nodes.table_header! : schema.nodes.table_cell!;
    const cells = Array.from({ length: width }, (_, column) => cellType.create(null, paragraph(row.children[column]?.children ?? [], context)));
    return schema.nodes.table_row!.create(null, cells);
  });
  return schema.nodes.table!.create(null, rows);
}

function blocks(nodes: RootContent[], context: Context): ProseMirrorNode[] {
  const { schema } = context;
  const out: ProseMirrorNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const only = node.children.length === 1 ? node.children[0] : undefined;
        out.push(paragraph(node.children, context));
        if (only?.type === "html" && !/^<\/?(u|mark|sub|sup|br)/i.test(only.value)) {
          out.pop();
          out.push(schema.nodes.paragraph!.create(null, schema.text(only.value)));
        }
        break;
      }
      case "heading":
        out.push(schema.nodes.heading!.create({ level: node.depth }, inline(node.children, [], context)));
        break;
      case "blockquote": {
        const content = blocks(node.children, context);
        out.push(schema.nodes.blockquote!.create(null, content.length ? content : [schema.nodes.paragraph!.create()]));
        break;
      }
      case "code":
        out.push(schema.nodes.code_block!.create({ language: node.lang ?? "" }, node.value ? schema.text(node.value) : null));
        break;
      case "thematicBreak":
        out.push(schema.nodes.horizontal_rule!.create());
        break;
      case "list":
        out.push(listItems(node, context));
        break;
      case "table":
        out.push(table(node, context));
        break;
      case "html":
        if (node.value.trim()) out.push(schema.nodes.paragraph!.create(null, schema.text(node.value)));
        break;
      case "definition":
        break;
      case "footnoteDefinition":
        out.push(...blocks(node.children, context));
        break;
      default:
        if ("children" in node) out.push(...blocks(node.children as RootContent[], context));
    }
  }
  return out;
}

function collectDefinitions(node: MdNode, definitions: Map<string, Definition>) {
  if (node.type === "definition") definitions.set(node.identifier.toLowerCase(), node);
  if ("children" in node) for (const child of node.children) collectDefinitions(child, definitions);
}

/**
 * Parses GitHub-flavored markdown into a RichTextEditor document: headings,
 * lists (including task lists), tables, code, quotes, rules, links, images
 * and inline marks. Unsafe link and image URLs are dropped; raw HTML stays
 * visible as text instead of being rendered.
 */
export function markdownToDoc(markdown: string, schema: Schema = richTextSchema): ProseMirrorNode {
  const tree = parser.parse(markdown) as Root;
  const definitions = new Map<string, Definition>();
  collectDefinitions(tree, definitions);
  const content = blocks(tree.children, { schema, definitions });
  return schema.nodes.doc!.create(null, content.length ? content : [schema.nodes.paragraph!.create()]);
}

/* ------------------------------------------------------------------ */
/* Serializer                                                          */
/* ------------------------------------------------------------------ */

const MARK_SYNTAX: Record<string, { open: string | ((mark: Mark) => string); close: string | ((mark: Mark) => string) }> = {
  strong: { open: "**", close: "**" },
  em: { open: "*", close: "*" },
  strike: { open: "~~", close: "~~" },
  underline: { open: "<u>", close: "</u>" },
  highlight: { open: "<mark>", close: "</mark>" },
  subscript: { open: "<sub>", close: "</sub>" },
  superscript: { open: "<sup>", close: "</sup>" },
  link: {
    open: "[",
    close: (mark) => `](${encodeUrl(mark.attrs.href as string)}${mark.attrs.title ? ` "${(mark.attrs.title as string).replace(/"/g, '\\"')}"` : ""})`,
  },
};

function encodeUrl(url: string): string {
  return url.replace(/[\s()<>]/g, (char) => encodeURIComponent(char));
}

function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]<>~|])/g, "\\$1");
}

function escapeLineStart(text: string): string {
  return text.replace(/^(\s*)(#{1,6}\s|>|[-+*]\s|\d+[.)]\s|={3,}|-{3,})/gm, (_, space: string, marker: string) => `${space}\\${marker}`);
}

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") || (text.startsWith(" ") && text.endsWith(" ") && text.trim()) ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function serializeInline(parent: ProseMirrorNode, tableCell = false): string {
  let out = "";
  let active: Mark[] = [];
  const syntax = (mark: Mark, side: "open" | "close") => {
    const entry = MARK_SYNTAX[mark.type.name];
    if (!entry) return "";
    const value = entry[side];
    return typeof value === "function" ? value(mark) : value;
  };
  const closeTo = (keep: number) => {
    while (active.length > keep) out += syntax(active.pop()!, "close");
  };

  parent.forEach((child) => {
    const marks = child.marks.filter((mark) => mark.type.name in MARK_SYNTAX);
    let keep = 0;
    while (keep < active.length && keep < marks.length && active[keep]!.eq(marks[keep]!)) keep++;
    if (child.isText) {
      const raw = child.text ?? "";
      const lead = keep < marks.length || keep < active.length ? (/^\s+/.exec(raw)?.[0] ?? "") : "";
      if (lead) {
        closeTo(keep);
        out += lead;
      } else {
        closeTo(keep);
      }
      for (const mark of marks.slice(keep)) {
        out += syntax(mark, "open");
        active.push(mark);
      }
      const body = raw.slice(lead.length);
      const isCode = child.marks.some((mark) => mark.type.name === "code");
      let text = isCode ? codeSpan(body) : escapeText(body);
      if (tableCell) text = text.replace(/\n/g, " ");
      out += text;
    } else {
      closeTo(keep);
      for (const mark of marks.slice(keep)) {
        out += syntax(mark, "open");
        active.push(mark);
      }
      if (child.type.name === "hard_break") out += tableCell ? "<br>" : "\\\n";
      else if (child.type.name === "image") {
        const alt = escapeText((child.attrs.alt as string) ?? "");
        const title = child.attrs.title ? ` "${(child.attrs.title as string).replace(/"/g, '\\"')}"` : "";
        out += `![${alt}](${encodeUrl(child.attrs.src as string)}${title})`;
      }
    }
  });
  closeTo(0);
  active = [];
  // Whitespace just inside a closing marker breaks emphasis; move it outside.
  return out.replace(/(\s+)(\*\*|\*|~~)(?=\s|$)/g, "$2$1");
}

function indent(text: string, prefix: string, first = prefix): string {
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? first + line : line ? prefix + line : line))
    .join("\n");
}

function serializeBlock(node: ProseMirrorNode): string {
  switch (node.type.name) {
    case "paragraph":
      return escapeLineStart(serializeInline(node));
    case "heading":
      return `${"#".repeat(node.attrs.level as number)} ${serializeInline(node)}`;
    case "blockquote":
      return indent(serializeBlocks(node), "> ").replace(/^>\s*$/gm, ">");
    case "code_block": {
      const text = node.textContent;
      const longest = Math.max(2, ...(text.match(/^`{3,}/gm) ?? []).map((run) => run.length));
      const fence = "`".repeat(longest + 1);
      return `${fence}${(node.attrs.language as string) ?? ""}\n${text}\n${fence}`;
    }
    case "horizontal_rule":
      return "---";
    case "bullet_list":
    case "ordered_list":
    case "task_list": {
      const items: string[] = [];
      node.forEach((item, _, index) => {
        const start = (node.attrs.order as number | undefined) ?? 1;
        const marker =
          node.type.name === "ordered_list" ? `${start + index}. ` : node.type.name === "task_list" ? `- [${item.attrs.checked ? "x" : " "}] ` : "- ";
        const body = serializeBlocks(item, "\n\n");
        items.push(indent(body, " ".repeat(node.type.name === "task_list" ? 2 : marker.length), marker));
      });
      const tight = items.every((item) => !item.includes("\n\n"));
      return items.join(tight ? "\n" : "\n\n");
    }
    case "table": {
      const rows: string[][] = [];
      node.forEach((row) => {
        const cells: string[] = [];
        row.forEach((cell) => {
          const parts: string[] = [];
          cell.forEach((block) => parts.push(block.isTextblock ? serializeInline(block, true) : block.textContent));
          cells.push(parts.join(" ").replace(/\|/g, "\\|") || " ");
        });
        rows.push(cells);
      });
      if (rows.length === 0) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, index) => cells[index] ?? " ").join(" | ")} |`;
      return [line(rows[0]!), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
    }
    default:
      return node.isTextblock ? serializeInline(node) : serializeBlocks(node);
  }
}

function serializeBlocks(node: ProseMirrorNode, separator = "\n\n"): string {
  const parts: string[] = [];
  node.forEach((child) => parts.push(serializeBlock(child)));
  return parts.join(separator);
}

/**
 * Serializes a RichTextEditor document to GitHub-flavored markdown. Marks
 * without markdown syntax (underline, highlight, sub/superscript) use inline
 * HTML tags; comment anchors are left out.
 */
export function docToMarkdown(doc: ProseMirrorNode): string {
  const output = serializeBlocks(doc).replace(/\n{3,}/g, "\n\n").trim();
  return output ? `${output}\n` : "";
}
