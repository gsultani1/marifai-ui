// packages/ai-ui/src/lib/rich-text/schema.ts
import { type DOMOutputSpec, type MarkSpec, type Node as ProseMirrorNode, type NodeSpec, Schema } from "prosemirror-model";
import { tableNodes } from "prosemirror-tables";

import { safeImageSrc, safeLinkHref } from "../safe-url.js";

export { safeImageSrc, safeLinkHref };

type Align = "left" | "center" | "right" | "justify" | null;

export const alignAttr = (dom: HTMLElement): Align => {
  const value = dom.style.textAlign;
  return value === "center" || value === "right" || value === "justify" ? value : null;
};

const withAlign = (node: ProseMirrorNode) => (node.attrs.align ? { style: `text-align: ${node.attrs.align}` } : {});

const nodes: Record<string, NodeSpec> = {
  doc: { content: "block+" },
  paragraph: {
    attrs: { align: { default: null } },
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p", getAttrs: (dom) => ({ align: alignAttr(dom as HTMLElement) }) }],
    toDOM: (node): DOMOutputSpec => ["p", withAlign(node), 0],
  },
  heading: {
    attrs: { level: { default: 1 }, align: { default: null } },
    content: "inline*",
    group: "block",
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, getAttrs: (dom: HTMLElement) => ({ level, align: alignAttr(dom) }) })),
    toDOM: (node): DOMOutputSpec => [`h${node.attrs.level as number}`, withAlign(node), 0],
  },
  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{ tag: "blockquote" }],
    toDOM: (): DOMOutputSpec => ["blockquote", 0],
  },
  code_block: {
    attrs: { language: { default: "" } },
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full",
        getAttrs: (dom) => ({ language: /language-([\w+#-]+)/.exec((dom as HTMLElement).querySelector("code")?.className ?? "")?.[1] ?? "" }),
      },
    ],
    toDOM: (node): DOMOutputSpec => ["pre", ["code", node.attrs.language ? { class: `language-${node.attrs.language as string}` } : {}, 0]],
  },
  horizontal_rule: {
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM: (): DOMOutputSpec => ["hr"],
  },
  bullet_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul", getAttrs: (dom) => ((dom as HTMLElement).dataset.type === "task-list" ? false : null) }],
    toDOM: (): DOMOutputSpec => ["ul", 0],
  },
  ordered_list: {
    attrs: { order: { default: 1 } },
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ol", getAttrs: (dom) => ({ order: Number((dom as HTMLElement).getAttribute("start") ?? 1) || 1 }) }],
    toDOM: (node): DOMOutputSpec => ["ol", node.attrs.order === 1 ? {} : { start: node.attrs.order as number }, 0],
  },
  list_item: {
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li", getAttrs: (dom) => ((dom as HTMLElement).dataset.type === "task-item" ? false : null) }],
    toDOM: (): DOMOutputSpec => ["li", 0],
  },
  task_list: {
    content: "task_item+",
    group: "block",
    parseDOM: [{ tag: 'ul[data-type="task-list"]', priority: 60 }],
    toDOM: (): DOMOutputSpec => ["ul", { "data-type": "task-list" }, 0],
  },
  task_item: {
    attrs: { checked: { default: false } },
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: 'li[data-type="task-item"]', priority: 60, getAttrs: (dom) => ({ checked: (dom as HTMLElement).dataset.checked === "true" }) }],
    toDOM: (node): DOMOutputSpec => ["li", { "data-type": "task-item", "data-checked": String(node.attrs.checked) }, 0],
  },
  image: {
    inline: true,
    attrs: { src: {}, alt: { default: "" }, title: { default: null } },
    group: "inline",
    draggable: true,
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          const src = safeImageSrc(element.getAttribute("src"));
          return src ? { src, alt: element.getAttribute("alt") ?? "", title: element.getAttribute("title") } : false;
        },
      },
    ],
    toDOM: (node): DOMOutputSpec => ["img", { src: node.attrs.src as string, alt: node.attrs.alt as string, ...(node.attrs.title ? { title: node.attrs.title as string } : {}) }],
  },
  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM: (): DOMOutputSpec => ["br"],
  },
  text: { group: "inline" },
  ...tableNodes({ tableGroup: "block", cellContent: "block+", cellAttributes: {} }),
};

const marks: Record<string, MarkSpec> = {
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (dom) => {
          const href = safeLinkHref((dom as HTMLElement).getAttribute("href"));
          return href ? { href, title: (dom as HTMLElement).getAttribute("title") } : false;
        },
      },
    ],
    toDOM: (mark): DOMOutputSpec => ["a", { href: mark.attrs.href as string, ...(mark.attrs.title ? { title: mark.attrs.title as string } : {}), rel: "noopener noreferrer nofollow" }, 0],
  },
  strong: {
    parseDOM: [{ tag: "strong" }, { tag: "b", getAttrs: (dom) => ((dom as HTMLElement).style.fontWeight !== "normal" ? null : false) }, { style: "font-weight=bold" }, { style: "font-weight", getAttrs: (value) => (/^(?:bold(?:er)?|[6-9]\d{2})$/.test(value as string) ? null : false) }],
    toDOM: (): DOMOutputSpec => ["strong", 0],
  },
  em: {
    parseDOM: [{ tag: "em" }, { tag: "i" }, { style: "font-style=italic" }],
    toDOM: (): DOMOutputSpec => ["em", 0],
  },
  underline: {
    parseDOM: [{ tag: "u" }, { style: "text-decoration", getAttrs: (value) => ((value as string).includes("underline") ? null : false) }],
    toDOM: (): DOMOutputSpec => ["u", 0],
  },
  strike: {
    parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }, { style: "text-decoration", getAttrs: (value) => ((value as string).includes("line-through") ? null : false) }],
    toDOM: (): DOMOutputSpec => ["s", 0],
  },
  code: {
    excludes: "_",
    parseDOM: [{ tag: "code" }],
    toDOM: (): DOMOutputSpec => ["code", 0],
  },
  highlight: {
    parseDOM: [{ tag: "mark" }],
    toDOM: (): DOMOutputSpec => ["mark", 0],
  },
  subscript: {
    excludes: "superscript",
    parseDOM: [{ tag: "sub" }, { style: "vertical-align", getAttrs: (value) => ((value as string) === "sub" ? null : false) }],
    toDOM: (): DOMOutputSpec => ["sub", 0],
  },
  superscript: {
    excludes: "subscript",
    parseDOM: [{ tag: "sup" }, { style: "vertical-align", getAttrs: (value) => ((value as string) === "super" ? null : false) }],
    toDOM: (): DOMOutputSpec => ["sup", 0],
  },
  comment: {
    attrs: { id: {} },
    inclusive: false,
    excludes: "",
    parseDOM: [{ tag: "span[data-comment-id]", getAttrs: (dom) => ({ id: (dom as HTMLElement).dataset.commentId }) }],
    toDOM: (mark): DOMOutputSpec => ["span", { "data-comment-id": mark.attrs.id as string, class: "rich-text-comment" }, 0],
  },
};

/**
 * Schema for RichTextEditor documents: paragraphs and headings with
 * alignment, quotes, code blocks, rules, bullet, numbered and task lists,
 * tables, images and hard breaks; bold, italic, underline, strike, code,
 * highlight, sub/superscript, links and anchored comments. Links and images
 * pass through URL allowlists when parsed from HTML.
 */
export const richTextSchema = new Schema({ nodes, marks });
