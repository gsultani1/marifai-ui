// packages/ai-ui/src/components/code-editor-view.tsx
"use client";

import { indentWithTab } from "@codemirror/commands";
import { Compartment, EditorSelection, EditorState, Prec, RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, placeholder as placeholderExtension, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { ArrowDownToLineIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useImperativeHandle, useState } from "react";

import { useCodeMirror } from "../hooks/use-code-mirror.js";
import { useControllableState } from "../hooks/use-controllable-state.js";
import { editorFrame, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { editorAppearance, loadLanguage } from "../lib/codemirror.js";
import { findSecretRanges } from "../lib/secrets.js";
import type { CodeEditorProps } from "./code-editor.js";

const hideGutters = EditorView.theme({ ".cm-gutters": { display: "none" } });

class SecretWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  override toDOM(): HTMLElement {
    const element = document.createElement("span");
    element.textContent = "••••••••";
    element.title = "Hidden secret";
    element.setAttribute("aria-label", "hidden secret");
    element.style.color = "var(--muted-foreground)";
    return element;
  }
}

const secretWidget = Decoration.replace({ widget: new SecretWidget() });

function secretDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const start = view.state.doc.lineAt(from).from;
    const end = view.state.doc.lineAt(to).to;
    for (const [rangeStart, rangeEnd] of findSecretRanges(view.state.sliceDoc(start, end))) builder.add(start + rangeStart, start + rangeEnd, secretWidget);
  }
  return builder.finish();
}

/** Replaces likely secrets with dots; the cursor skips over them as a unit. */
const secretMask = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = secretDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = secretDecorations(update.view);
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
);

const FOLLOW_THRESHOLD = 48;

export function CodeEditorView({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  language,
  readOnly = false,
  lineNumbers = true,
  wrap = false,
  placeholder,
  autoFocus = false,
  extensions,
  className,
  "aria-label": ariaLabel = "Code editor",
  ref,
  onSave,
  streaming = false,
  streamingLabel = "The assistant is writing this file",
  maskSecrets = false,
}: Omit<CodeEditorProps, "fallback" | "onLoadError" | "binaryFallback">) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(true);
  const [wasStreaming, setWasStreaming] = useState(streaming);
  const [revealed, setRevealed] = useState(false);
  const [compartments] = useState(() => ({
    language: new Compartment(),
    editable: new Compartment(),
    layout: new Compartment(),
    save: new Compartment(),
    mask: new Compartment(),
  }));
  const hasSecrets = maskSecrets && findSecretRanges(value).length > 0;

  if (streaming !== wasStreaming) {
    setWasStreaming(streaming);
    if (streaming) setFollowing(true);
  }

  const viewRef = useCodeMirror(container, value, setValue, () => [
    basicSetup,
    keymap.of([indentWithTab]),
    editorAppearance,
    compartments.language.of([]),
    compartments.editable.of([]),
    compartments.layout.of([]),
    compartments.save.of([]),
    compartments.mask.of([]),
    extensions ?? [],
  ]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      getView: () => viewRef.current,
      revealLine: (line, column = 1) => {
        const view = viewRef.current;
        if (!view) return;
        const target = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, Math.floor(line))));
        const position = Math.min(target.to, target.from + Math.max(0, column - 1));
        view.dispatch({ selection: EditorSelection.cursor(position), effects: EditorView.scrollIntoView(position, { y: "center" }) });
        view.focus();
      },
    }),
    [viewRef],
  );

  useEffect(() => {
    let cancelled = false;
    void loadLanguage(language).then((support) => {
      if (!cancelled) viewRef.current?.dispatch({ effects: compartments.language.reconfigure(support ?? []) });
    });
    return () => {
      cancelled = true;
    };
  }, [language, container, compartments, viewRef]);

  useEffect(() => {
    const locked = readOnly || streaming;
    viewRef.current?.dispatch({
      effects: compartments.editable.reconfigure([
        EditorState.readOnly.of(locked),
        EditorView.contentAttributes.of({ "aria-label": ariaLabel, "aria-readonly": String(locked), tabindex: "0" }),
        placeholder ? placeholderExtension(placeholder) : [],
      ]),
    });
  }, [readOnly, streaming, ariaLabel, placeholder, container, compartments, viewRef]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.layout.reconfigure([lineNumbers ? [] : hideGutters, wrap ? EditorView.lineWrapping : []]),
    });
  }, [lineNumbers, wrap, container, compartments, viewRef]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.save.reconfigure(
        onSave
          ? Prec.highest(
              keymap.of([
                {
                  key: "Mod-s",
                  preventDefault: true,
                  run: (view) => {
                    onSave(view.state.doc.toString());
                    return true;
                  },
                },
              ]),
            )
          : [],
      ),
    });
  }, [onSave, container, compartments, viewRef]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.mask.reconfigure(maskSecrets && !revealed ? secretMask : []) });
  }, [maskSecrets, revealed, container, compartments, viewRef]);

  useEffect(() => {
    if (autoFocus) viewRef.current?.focus();
  }, [autoFocus, container, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!streaming || !view) return;
    const scroller = view.scrollDOM;
    const onScroll = () => setFollowing(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < FOLLOW_THRESHOLD);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [streaming, container, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!streaming || !following || !view) return;
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.length, { y: "end" }) });
  }, [value, streaming, following, viewRef]);

  return (
    <div data-slot="code-editor" data-streaming={streaming || undefined} className={cn(editorFrame, "flex flex-col focus-within:ring-2 focus-within:ring-ring/40", className)}>
      {(streaming || hasSecrets) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
          {streaming && (
            <p role="status" className="flex min-w-0 flex-1 items-center gap-1.5">
              <LoaderCircleIcon aria-hidden="true" className="size-3.5 shrink-0 motion-safe:animate-spin" />
              <span className="truncate">{streamingLabel}</span>
            </p>
          )}
          {streaming && !following && (
            <button type="button" onClick={() => setFollowing(true)} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-foreground hover:bg-accent [&_svg]:size-3.5", focusRing)}>
              <ArrowDownToLineIcon aria-hidden="true" />
              Follow
            </button>
          )}
          {hasSecrets && (
            <button type="button" aria-pressed={revealed} onClick={() => setRevealed(!revealed)} className={cn("ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-foreground hover:bg-accent [&_svg]:size-3.5", focusRing)}>
              {revealed ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
              Show secrets
            </button>
          )}
        </div>
      )}
      <div ref={setContainer} className="min-h-0 flex-1" />
    </div>
  );
}
