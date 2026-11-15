// packages/ai-ui/src/components/rich-text-editor.tsx
"use client";

import type { ReactNode } from "react";

import { createLazyLoader, useLazyModule } from "../hooks/use-lazy-module.js";
import { cn } from "../lib/cn.js";
import { EditorFallback } from "./editor-fallback.js";
import { MessageContent } from "./message-content.js";
import type { RichTextEditorViewProps } from "./rich-text-editor-view.js";

export type { RichTextComment, RichTextDocument, RichTextEditorHandle } from "./rich-text-editor-view.js";

export interface RichTextEditorProps extends RichTextEditorViewProps {
  /** Shown while the editor chunk loads; defaults to the rendered markdown. */
  fallback?: ReactNode;
  /** Called when the editor chunk fails to load. The rendered document stays visible with a retry button. */
  onLoadError?: (error: unknown) => void;
}

const richTextEditorView = createLazyLoader(() => import("./rich-text-editor-view.js"));

export function preloadRichTextEditor(): Promise<void> {
  return richTextEditorView.load().then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Word-processor style editor for documents: formatting toolbar, markdown
 * shortcuts, "/" commands, lists and to-dos, tables, links, images, find and
 * replace, comments and export. Content goes in and out as markdown. The
 * ProseMirror editor is code-split and loads on first use.
 */
export function RichTextEditor({ fallback, onLoadError, ...props }: RichTextEditorProps) {
  const { module, failed, recovered, retry } = useLazyModule(richTextEditorView, onLoadError);
  if (module) return <module.RichTextEditorView {...props} autoFocus={props.autoFocus || recovered} />;
  return (
    <EditorFallback slot="rich-text-editor" failed={failed} onRetry={retry} className={cn("min-h-64 overflow-hidden rounded-lg border border-border bg-background", props.className)}>
      {fallback ?? <MessageContent className="mx-auto max-w-3xl px-6 py-6">{props.value ?? props.defaultValue ?? ""}</MessageContent>}
    </EditorFallback>
  );
}
