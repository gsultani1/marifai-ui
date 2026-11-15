// packages/ai-ui/src/components/code-editor.tsx
"use client";

import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { ReactNode, Ref } from "react";

import { createLazyLoader, useLazyModule } from "../hooks/use-lazy-module.js";
import { editorFrame } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { looksBinary, maskSecrets } from "../lib/secrets.js";
import { BinaryFilePlaceholder } from "./binary-file-placeholder.js";
import { EditorFallback } from "./editor-fallback.js";

export interface CodeEditorHandle {
  focus: () => void;
  /** The CodeMirror view, or null until the editor has loaded. */
  getView: () => EditorView | null;
  /** Moves the cursor to a 1-based line and column, scrolls it to the middle and focuses the editor. */
  revealLine: (line: number, column?: number) => void;
}

export interface CodeEditorProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Language name, alias or file extension known to @codemirror/language-data, e.g. "tsx" or "python". */
  language?: string | undefined;
  readOnly?: boolean;
  lineNumbers?: boolean;
  /** Soft-wraps long lines. */
  wrap?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Extra CodeMirror extensions, read once on mount. */
  extensions?: Extension[];
  className?: string;
  "aria-label"?: string;
  /** Set once the editor has loaded. */
  ref?: Ref<CodeEditorHandle>;
  /** Shown while the editor chunk loads; defaults to the read-only text. */
  fallback?: ReactNode;
  /** Called when the editor chunk fails to load. The text stays visible with a retry button. */
  onLoadError?: (error: unknown) => void;
  /** Called with the text on Ctrl or Cmd+S. */
  onSave?: (value: string) => void;
  /** The assistant is writing the file: read-only with a notice, following new text until the user scrolls up. */
  streaming?: boolean;
  /** Notice shown while streaming. */
  streamingLabel?: string;
  /** Hides likely secrets (API keys, tokens, passwords, private keys) until the user reveals them. */
  maskSecrets?: boolean;
  /** Shown instead of the editor when the text looks like a decoded binary file. */
  binaryFallback?: ReactNode;
}

const codeEditorView = createLazyLoader(() => import("./code-editor-view.js"));

/** Starts downloading the editor chunk ahead of first render, e.g. on hover. */
export function preloadCodeEditor(): Promise<void> {
  return codeEditorView.load().then(
    () => undefined,
    () => undefined,
  );
}

/**
 * CodeMirror 6 editor with syntax highlighting for every language in
 * @codemirror/language-data. CodeMirror and the grammar are code-split and
 * load on first render. Tab indents; press Escape then Tab to move focus out.
 */
export function CodeEditor({ fallback, onLoadError, binaryFallback, ...props }: CodeEditorProps) {
  const { module, failed, recovered, retry } = useLazyModule(codeEditorView, onLoadError);
  const text = props.value ?? props.defaultValue ?? "";
  if (looksBinary(text)) return <div className={cn(editorFrame, "flex", props.className)}>{binaryFallback ?? <BinaryFilePlaceholder />}</div>;
  if (module) return <module.CodeEditorView {...props} autoFocus={props.autoFocus || recovered} />;
  return (
    <EditorFallback slot="code-editor" failed={failed} onRetry={retry} className={cn(editorFrame, props.className)}>
      {fallback ?? (
        <pre
          tabIndex={0}
          aria-label={props["aria-label"] ?? "Code editor"}
          className="min-h-full p-3 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {props.maskSecrets ? maskSecrets(text) : text}
        </pre>
      )}
    </EditorFallback>
  );
}
