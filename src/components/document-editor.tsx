// packages/ai-ui/src/components/document-editor.tsx
"use client";

import type { EditorView } from "@codemirror/view";
import type { ReactNode, Ref } from "react";

import { createLazyLoader, useLazyModule } from "../hooks/use-lazy-module.js";
import { cn } from "../lib/cn.js";
import { EditorFallback } from "./editor-fallback.js";
import { MessageContent } from "./message-content.js";

export type DocumentEditorLayout = "edit" | "split" | "preview";

export interface DocumentEditorHandle {
  focus: () => void;
  /** Wraps each selection in markers, or unwraps it when already wrapped, e.g. `wrapSelection("**")`. */
  wrapSelection: (before: string, after?: string) => void;
  /** The CodeMirror view, or null until the editor has loaded. */
  getView: () => EditorView | null;
}

export interface DocumentEditorProps {
  /** Markdown source. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  layout?: DocumentEditorLayout;
  defaultLayout?: DocumentEditorLayout;
  onLayoutChange?: (layout: DocumentEditorLayout) => void;
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Extra controls at the end of the toolbar. */
  toolbarActions?: ReactNode;
  className?: string;
  "aria-label"?: string;
  /** Set once the editor has loaded. */
  ref?: Ref<DocumentEditorHandle>;
  /** Shown while the editor chunk loads; defaults to the rendered preview. */
  fallback?: ReactNode;
  /** Called when the editor chunk fails to load. The preview stays visible with a retry button. */
  onLoadError?: (error: unknown) => void;
}

const documentEditorView = createLazyLoader(() => import("./document-editor-view.js"));

export function preloadDocumentEditor(): Promise<void> {
  return documentEditorView.load().then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Markdown document editor: a CodeMirror source pane with formatting
 * commands (Mod-B, Mod-I, Mod-K) and a live preview rendered by
 * MessageContent, shown side by side or one at a time. Code-split like
 * CodeEditor.
 */
export function DocumentEditor({ fallback, onLoadError, ...props }: DocumentEditorProps) {
  const { module, failed, recovered, retry } = useLazyModule(documentEditorView, onLoadError);
  if (module) return <module.DocumentEditorView {...props} autoFocus={props.autoFocus || recovered} />;
  return (
    <EditorFallback
      slot="document-editor"
      failed={failed}
      onRetry={retry}
      className={cn("min-h-64 overflow-hidden rounded-lg border border-border bg-background", props.className)}
    >
      {fallback ?? (
        <MessageContent className="mx-auto max-w-3xl px-6 py-6">{props.value ?? props.defaultValue ?? ""}</MessageContent>
      )}
    </EditorFallback>
  );
}
