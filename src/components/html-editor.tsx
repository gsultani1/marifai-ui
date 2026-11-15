// packages/ai-ui/src/components/html-editor.tsx
"use client";

import type { ReactNode } from "react";

import { createLazyLoader, useLazyModule } from "../hooks/use-lazy-module.js";
import { cn } from "../lib/cn.js";
import { htmlToText } from "../lib/html-text.js";
import { EditorFallback } from "./editor-fallback.js";
import type { HtmlEditorViewProps } from "./html-editor-view.js";

export type { HtmlEditorHandle } from "./html-editor-view.js";

export interface HtmlEditorProps extends HtmlEditorViewProps {
  /** Shown while the editor chunk loads; defaults to the document's text. */
  fallback?: ReactNode;
  /** Called when the editor chunk fails to load. The text stays visible with a retry button. */
  onLoadError?: (error: unknown) => void;
}

const htmlEditorView = createLazyLoader(() => import("./html-editor-view.js"));

export function preloadHtmlEditor(): Promise<void> {
  return htmlEditorView.load().then(
    () => undefined,
    () => undefined,
  );
}

/**
 * WYSIWYG HTML editor for CMS pages, product descriptions and email
 * bodies: fonts, sizes, colors, alignment, indents, lists, tables, links,
 * images, video embeds, an HTML source view and cleanup of content pasted
 * from Word and Google Docs. Content goes in and out as sanitized HTML. The
 * ProseMirror editor is code-split and loads on first use; until then, and
 * on the server, the document shows as plain text.
 */
export function HtmlEditor({ fallback, onLoadError, ...props }: HtmlEditorProps) {
  const { module, failed, recovered, retry } = useLazyModule(htmlEditorView, onLoadError);
  if (module) return <module.HtmlEditorView {...props} autoFocus={props.autoFocus || recovered} />;
  const text = htmlToText(props.value ?? props.defaultValue ?? "");
  return (
    <EditorFallback slot="html-editor" failed={failed} onRetry={retry} className={cn("min-h-64 overflow-hidden rounded-lg border border-border bg-background", props.className)}>
      {fallback ?? (
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-6 text-[15px] leading-7">
          {text.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </EditorFallback>
  );
}
