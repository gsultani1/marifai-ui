// packages/ai-ui/src/components/message-content.tsx
"use client";

import type { Element, ElementContent } from "hast";
import { type ComponentProps, createElement, type JSX, memo, useMemo } from "react";
import ReactMarkdown, { type Components, type ExtraProps, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { repairMarkdown, splitMarkdownBlocks } from "../lib/markdown.js";
import { CodeBlock } from "./code-block.js";

type MarkdownProps<T extends keyof JSX.IntrinsicElements> = ComponentProps<T> & ExtraProps;

function styled<T extends keyof JSX.IntrinsicElements>(tag: T, base: string) {
  return function Styled({ node: _node, className, ...props }: MarkdownProps<T>) {
    return createElement(tag, { ...props, className: cn(base, className) });
  };
}

function Anchor({ node: _node, className, href, children, ...props }: MarkdownProps<"a">) {
  const external = typeof href === "string" && /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      className={cn("rounded-sm font-medium text-primary underline underline-offset-4 hover:opacity-80", focusRing, className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    >
      {children}
      {external && <span className="sr-only"> (opens in new tab)</span>}
    </a>
  );
}

function Table({ node: _node, className, ...props }: MarkdownProps<"table">) {
  return (
    <div
      role="region"
      aria-label="Table"
      tabIndex={0}
      className={cn("my-4 w-full overflow-x-auto rounded-lg border border-border", focusRing)}
    >
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

function ImagePlaceholder({ alt }: MarkdownProps<"img">) {
  return <span className="text-muted-foreground">[Image{alt ? `: ${alt}` : ""}]</span>;
}

function Image({ node: _node, className, alt, ...props }: MarkdownProps<"img">) {
  return (
    <img
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("my-4 max-w-full rounded-lg", className)}
      {...props}
    />
  );
}

function Pre({ node, className, children, ...props }: MarkdownProps<"pre">) {
  const code = node?.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "code",
  );
  if (!code) {
    return (
      <pre className={className} {...props}>
        {children}
      </pre>
    );
  }
  const names = code.properties.className;
  const language = Array.isArray(names)
    ? names.map(String).find((name) => name.startsWith("language-"))?.slice("language-".length)
    : undefined;
  return <CodeBlock code={textContent(code).replace(/\n$/, "")} language={language} className="my-4" />;
}

function textContent(node: Element | ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textContent).join("");
  return "";
}

const defaultComponents: Components = {
  p: styled("p", "my-3"),
  a: Anchor,
  strong: styled("strong", "font-semibold"),
  h1: styled("h1", "mt-6 mb-3 text-2xl font-semibold tracking-tight"),
  h2: styled("h2", "mt-6 mb-3 text-xl font-semibold tracking-tight"),
  h3: styled("h3", "mt-5 mb-2 text-lg font-semibold"),
  h4: styled("h4", "mt-4 mb-2 font-semibold"),
  h5: styled("h5", "mt-4 mb-2 font-semibold"),
  h6: styled("h6", "mt-4 mb-2 font-semibold text-muted-foreground"),
  ul: styled("ul", "my-3 list-disc space-y-1 pl-6 marker:text-muted-foreground [&.contains-task-list]:pl-1"),
  ol: styled("ol", "my-3 list-decimal space-y-1 pl-6 marker:text-muted-foreground"),
  li: styled("li", "pl-1 [&.task-list-item]:list-none [&>ol]:my-1 [&>ul]:my-1"),
  input: styled("input", "mr-2 size-3.5 translate-y-0.5 accent-primary"),
  blockquote: styled("blockquote", "my-4 border-l-2 border-border pl-4 text-muted-foreground italic"),
  hr: styled("hr", "my-6 border-border"),
  table: Table,
  thead: styled("thead", "bg-muted/50"),
  th: styled("th", "border-b border-border px-3 py-2 text-left font-semibold"),
  td: styled("td", "border-b border-border px-3 py-2 align-top [tr:last-child>&]:border-b-0"),
  code: styled("code", "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.875em]"),
  pre: Pre,
  img: ImagePlaceholder,
};

interface MarkdownBlockProps {
  content: string;
  components: Components;
  remarkPlugins: Options["remarkPlugins"];
  rehypePlugins: Options["rehypePlugins"];
  urlTransform: Options["urlTransform"];
}

const MarkdownBlock = memo(function MarkdownBlock({ content, ...options }: MarkdownBlockProps) {
  return <ReactMarkdown {...options}>{content}</ReactMarkdown>;
});

export interface MessageContentProps extends Omit<ComponentProps<"div">, "children"> {
  /** Markdown source. May be partial while `streaming` is true. */
  children: string;
  streaming?: boolean;
  /**
   * Loads markdown images. Off by default because a remote image URL in model
   * output can track the reader or exfiltrate conversation data in its query
   * string; images then render as "[Image: alt]".
   */
  allowImages?: boolean;
  /** Element overrides merged over the defaults. Keep the object stable across renders. */
  components?: Components;
  /** Added after remark-gfm. Keep the array stable across renders. */
  remarkPlugins?: Options["remarkPlugins"];
  rehypePlugins?: Options["rehypePlugins"];
  urlTransform?: Options["urlTransform"];
}

export function MessageContent({
  children,
  streaming = false,
  allowImages = false,
  components,
  remarkPlugins,
  rehypePlugins,
  urlTransform,
  className,
  ...props
}: MessageContentProps) {
  const blocks = useMemo(() => splitMarkdownBlocks(children), [children]);
  const mergedComponents = useMemo(
    () => ({ ...defaultComponents, ...(allowImages ? { img: Image } : null), ...components }),
    [allowImages, components],
  );
  const mergedRemarkPlugins = useMemo(() => [remarkGfm, ...(remarkPlugins ?? [])], [remarkPlugins]);

  return (
    <div
      data-slot="message-content"
      aria-busy={streaming || undefined}
      className={cn("min-w-0 leading-relaxed break-words *:first:mt-0 *:last:mb-0", className)}
      {...props}
    >
      {blocks.map((block, index) => (
        <MarkdownBlock
          key={index}
          content={streaming && index === blocks.length - 1 ? repairMarkdown(block) : block}
          components={mergedComponents}
          remarkPlugins={mergedRemarkPlugins}
          rehypePlugins={rehypePlugins}
          urlTransform={urlTransform}
        />
      ))}
    </div>
  );
}
