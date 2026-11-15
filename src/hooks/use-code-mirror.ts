// packages/ai-ui/src/hooks/use-code-mirror.ts
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { type RefObject, useEffect, useRef } from "react";

import { externalChange } from "../lib/codemirror.js";

/**
 * Mounts a CodeMirror view into `container` and keeps its document in sync
 * with `value`. External updates are applied as a minimal tail edit so
 * streamed content keeps the cursor and scroll position. User edits are
 * applied first and reported through `onChange`; a controlled parent that
 * wants to veto an edit should use `readOnly` rather than ignore the change.
 * `createExtensions` is read once per mount; reconfigure later through
 * compartments.
 */
export function useCodeMirror(
  container: HTMLElement | null,
  value: string,
  onChange: ((value: string) => void) | undefined,
  createExtensions: () => Extension,
): RefObject<EditorView | null> {
  const viewRef = useRef<EditorView | null>(null);
  const latest = useRef({ value, onChange, createExtensions });

  useEffect(() => {
    latest.current = { value, onChange, createExtensions };
  });

  useEffect(() => {
    if (!container) return;
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: latest.current.value,
        extensions: [
          latest.current.createExtensions(),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            if (update.transactions.some((transaction) => transaction.annotation(externalChange))) return;
            latest.current.onChange?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [container]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    let start = 0;
    const limit = Math.min(current.length, value.length);
    while (start < limit && current.charCodeAt(start) === value.charCodeAt(start)) start++;
    view.dispatch({
      changes: { from: start, to: current.length, insert: value.slice(start) },
      annotations: externalChange.of(true),
    });
  }, [value]);

  return viewRef;
}
