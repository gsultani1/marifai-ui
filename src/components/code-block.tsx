// packages/ai-ui/src/components/code-block.tsx
"use client";

import type { RootContent } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { common, createLowlight } from "lowlight";
import { CheckIcon, CircleAlertIcon, CopyIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

/**
 * Shared lowlight instance with highlight.js "common" grammars. Register
 * more before rendering, e.g. `codeHighlighter.register({ powershell })`.
 */
export const codeHighlighter: ReturnType<typeof createLowlight> = createLowlight(common);

const TOKEN_CLASSES: Record<string, string> = {
  "hljs-comment": "text-code-comment italic",
  "hljs-quote": "text-code-comment italic",
  "hljs-keyword": "text-code-keyword",
  "hljs-selector-tag": "text-code-keyword",
  "hljs-doctag": "text-code-keyword",
  "hljs-bullet": "text-code-keyword",
  "hljs-string": "text-code-string",
  "hljs-regexp": "text-code-string",
  "hljs-symbol": "text-code-string",
  "hljs-number": "text-code-number",
  "hljs-literal": "text-code-number",
  "hljs-title": "text-code-function",
  "hljs-section": "text-code-function font-semibold",
  "hljs-built_in": "text-code-type",
  "hljs-type": "text-code-type",
  "hljs-attr": "text-code-property",
  "hljs-attribute": "text-code-property",
  "hljs-property": "text-code-property",
  "hljs-variable": "text-code-variable",
  "hljs-template-variable": "text-code-variable",
  "hljs-name": "text-code-tag",
  "hljs-selector-id": "text-code-tag",
  "hljs-selector-class": "text-code-tag",
  "hljs-selector-attr": "text-code-tag",
  "hljs-selector-pseudo": "text-code-tag",
  "hljs-meta": "text-code-meta",
  "hljs-tag": "text-code-punctuation",
  "hljs-operator": "text-code-punctuation",
  "hljs-punctuation": "text-code-punctuation",
  "hljs-subst": "text-code-foreground",
  "hljs-addition": "text-code-inserted",
  "hljs-deletion": "text-code-deleted",
  "hljs-emphasis": "italic",
  "hljs-strong": "font-semibold",
  "hljs-link": "underline",
  class_: "text-code-type",
  function_: "text-code-function",
  language_: "text-code-keyword",
};

function applyTokenClasses(nodes: RootContent[]): void {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    const names = node.properties.className;
    if (Array.isArray(names)) {
      node.properties.className = cn(names.map((name) => TOKEN_CLASSES[String(name)])).split(" ").filter(Boolean);
    }
    applyTokenClasses(node.children);
  }
}

/** Longer inputs render as plain text; highlighting them would block the main thread. */
const MAX_HIGHLIGHT_LENGTH = 50_000;

function highlight(code: string, language: string | undefined): ReactNode {
  if (!language || code.length > MAX_HIGHLIGHT_LENGTH || !codeHighlighter.registered(language)) return code;
  try {
    const tree = codeHighlighter.highlight(language, code);
    applyTokenClasses(tree.children);
    return toJsxRuntime(tree, { Fragment, jsx, jsxs });
  } catch {
    return code;
  }
}

export interface CodeBlockProps extends Omit<ComponentProps<"div">, "children" | "title"> {
  code: string;
  language?: string | undefined;
  /** Replaces the language label in the header, e.g. a file name. */
  title?: ReactNode;
  showLineNumbers?: boolean;
  /** Extra header controls rendered before the copy button. */
  actions?: ReactNode;
  onCopyError?: (error: unknown) => void;
}

export function CodeBlock({
  code,
  language,
  title,
  showLineNumbers = false,
  actions,
  onCopyError,
  className,
  ...props
}: CodeBlockProps) {
  const highlighted = useMemo(() => highlight(code, language), [code, language]);
  const lineCount = showLineNumbers ? code.split("\n").length : 0;
  const label = language || "text";

  return (
    <div
      data-slot="code-block"
      data-language={language}
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-code-background text-code-foreground",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border py-1 pr-1 pl-3 text-xs text-muted-foreground">
        <span className="truncate font-mono">{title ?? label}</span>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <CodeBlockCopyButton code={code} onCopyError={onCopyError} />
        </div>
      </div>
      <div className="flex">
        {showLineNumbers && (
          <div
            aria-hidden="true"
            data-slot="code-block-line-numbers"
            className="shrink-0 py-3 pr-2 pl-3 text-right font-mono text-sm leading-6 text-muted-foreground/60 select-none"
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
        )}
        <pre
          tabIndex={0}
          className="min-w-0 flex-1 overflow-x-auto p-3 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <code>{highlighted}</code>
        </pre>
      </div>
    </div>
  );
}

export interface CodeBlockCopyButtonProps extends ComponentProps<"button"> {
  code: string;
  onCopyError?: ((error: unknown) => void) | undefined;
}

const COPY_LABELS = { idle: "Copy", copied: "Copied", error: "Copy failed" } as const;

export function CodeBlockCopyButton({ code, onCopyError, className, onClick, ...props }: CodeBlockCopyButtonProps) {
  const { status, copy } = useCopyToClipboard({ onError: onCopyError });
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) void copy(code);
      }}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5",
        focusRing,
        className,
      )}
      {...props}
    >
      {status === "copied" ? (
        <CheckIcon aria-hidden="true" />
      ) : status === "error" ? (
        <CircleAlertIcon aria-hidden="true" className="text-destructive" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
      <span aria-live="polite">{COPY_LABELS[status]}</span>
    </button>
  );
}
