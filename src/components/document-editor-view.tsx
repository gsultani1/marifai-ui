// packages/ai-ui/src/components/document-editor-view.tsx
"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder as placeholderExtension,
} from "@codemirror/view";
import {
  BoldIcon,
  CodeIcon,
  Columns2Icon,
  EyeIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PencilLineIcon,
  QuoteIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useImperativeHandle, useState } from "react";

import { useCodeMirror } from "../hooks/use-code-mirror.js";
import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { editorAppearance, languages } from "../lib/codemirror.js";
import type { DocumentEditorLayout, DocumentEditorProps } from "./document-editor.js";
import { MessageContent } from "./message-content.js";

function wrapSelection(view: EditorView, before: string, after = before): boolean {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to);
      const wrapped = text.length >= before.length + after.length && text.startsWith(before) && text.endsWith(after);
      if (wrapped) {
        return {
          changes: { from: range.from, to: range.to, insert: text.slice(before.length, text.length - after.length) },
          range: EditorSelection.range(range.from, range.to - before.length - after.length),
        };
      }
      return {
        changes: [
          { from: range.from, insert: before },
          { from: range.to, insert: after },
        ],
        range: EditorSelection.range(range.from + before.length, range.to + before.length),
      };
    }),
  );
  view.focus();
  return true;
}

function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    for (let line = state.doc.lineAt(range.from).number; line <= state.doc.lineAt(range.to).number; line++) {
      lines.add(line);
    }
  }
  const targets = [...lines].map((number) => state.doc.line(number));
  const remove = targets.every((line) => line.text.startsWith(prefix));
  view.dispatch({
    changes: targets.map((line) =>
      remove ? { from: line.from, to: line.from + prefix.length } : { from: line.from, insert: prefix },
    ),
  });
  view.focus();
  return true;
}

function insertLink(view: EditorView): boolean {
  view.dispatch(
    view.state.changeByRange((range) => {
      const label = view.state.sliceDoc(range.from, range.to) || "link";
      const insert = `[${label}](url)`;
      const urlStart = range.from + label.length + 3;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(urlStart, urlStart + 3),
      };
    }),
  );
  view.focus();
  return true;
}

function insertCode(view: EditorView): boolean {
  const range = view.state.selection.main;
  const text = view.state.sliceDoc(range.from, range.to);
  return text.includes("\n") ? wrapSelection(view, "```\n", "\n```") : wrapSelection(view, "`");
}

const FORMAT_COMMANDS: Array<{ label: string; icon: ReactNode; run: (view: EditorView) => boolean }> = [
  { label: "Bold", icon: <BoldIcon aria-hidden="true" />, run: (view) => wrapSelection(view, "**") },
  { label: "Italic", icon: <ItalicIcon aria-hidden="true" />, run: (view) => wrapSelection(view, "_") },
  { label: "Heading", icon: <Heading2Icon aria-hidden="true" />, run: (view) => toggleLinePrefix(view, "## ") },
  { label: "Bulleted list", icon: <ListIcon aria-hidden="true" />, run: (view) => toggleLinePrefix(view, "- ") },
  { label: "Numbered list", icon: <ListOrderedIcon aria-hidden="true" />, run: (view) => toggleLinePrefix(view, "1. ") },
  { label: "Quote", icon: <QuoteIcon aria-hidden="true" />, run: (view) => toggleLinePrefix(view, "> ") },
  { label: "Code", icon: <CodeIcon aria-hidden="true" />, run: insertCode },
  { label: "Link", icon: <LinkIcon aria-hidden="true" />, run: insertLink },
];

const LAYOUTS: Array<{ value: DocumentEditorLayout; label: string; icon: ReactNode }> = [
  { value: "edit", label: "Edit", icon: <PencilLineIcon aria-hidden="true" /> },
  { value: "split", label: "Split view", icon: <Columns2Icon aria-hidden="true" /> },
  { value: "preview", label: "Preview", icon: <EyeIcon aria-hidden="true" /> },
];

const toolbarButton = cn(iconButton, "aria-pressed:bg-accent aria-pressed:text-accent-foreground", focusRing);

export function DocumentEditorView({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  layout: layoutProp,
  defaultLayout = "split",
  onLayoutChange,
  readOnly = false,
  placeholder,
  autoFocus = false,
  toolbarActions,
  className,
  "aria-label": ariaLabel = "Document",
  ref,
}: Omit<DocumentEditorProps, "fallback" | "onLoadError">) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [layout, setLayout] = useControllableState({
    value: layoutProp,
    defaultValue: defaultLayout,
    onChange: onLayoutChange,
  });
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [editable] = useState(() => new Compartment());

  const viewRef = useCodeMirror(container, value, setValue, () => [
    history(),
    drawSelection(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    keymap.of([
      { key: "Mod-b", run: (view) => wrapSelection(view, "**") },
      { key: "Mod-i", run: (view) => wrapSelection(view, "_") },
      { key: "Mod-k", run: insertLink },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    editorAppearance,
    EditorView.theme({ ".cm-content": { padding: "1.5rem 0" }, ".cm-line": { padding: "0 1.5rem" } }),
    editable.of([]),
  ]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      wrapSelection: (before: string, after?: string) => {
        const view = viewRef.current;
        if (view) wrapSelection(view, before, after);
      },
      getView: () => viewRef.current,
    }),
    [viewRef],
  );

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editable.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.contentAttributes.of({
          "aria-label": `${ariaLabel} source`,
          "aria-multiline": "true",
          "aria-readonly": String(readOnly),
        }),
        placeholder ? placeholderExtension(placeholder) : [],
      ]),
    });
  }, [readOnly, ariaLabel, placeholder, container, editable, viewRef]);

  useEffect(() => {
    if (autoFocus) viewRef.current?.focus();
  }, [autoFocus, container, viewRef]);

  const formattingDisabled = readOnly || layout === "preview";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-slot="document-editor"
      data-layout={layout}
      className={cn("flex min-h-64 flex-col overflow-hidden rounded-lg border border-border bg-background", className)}
    >
      <Toolbar.Root
        aria-label="Formatting"
        className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-1.5"
      >
        {FORMAT_COMMANDS.map((command) => (
          <Toolbar.Button
            key={command.label}
            aria-label={command.label}
            title={command.label}
            disabled={formattingDisabled}
            onClick={() => {
              const view = viewRef.current;
              if (view) command.run(view);
            }}
            className={toolbarButton}
          >
            {command.icon}
          </Toolbar.Button>
        ))}
        <Toolbar.Separator className="mx-1 h-5 w-px shrink-0 bg-border" />
        <Toolbar.Group aria-label="Layout" className="flex items-center gap-0.5">
          {LAYOUTS.map((option) => (
            <Toolbar.Button
              key={option.value}
              aria-label={option.label}
              title={option.label}
              aria-pressed={layout === option.value}
              onClick={() => setLayout(option.value)}
              className={toolbarButton}
            >
              {option.icon}
            </Toolbar.Button>
          ))}
        </Toolbar.Group>
        {toolbarActions && <div className="ml-auto flex items-center gap-0.5">{toolbarActions}</div>}
      </Toolbar.Root>
      <div className={cn("grid min-h-0 flex-1", layout === "split" && "md:grid-cols-2")}>
        <div
          ref={setContainer}
          className={cn(
            "min-h-0 overflow-hidden",
            layout === "preview" && "hidden",
            layout === "split" && "md:border-r md:border-border",
          )}
        />
        {layout !== "edit" && (
          <div
            aria-label={`${ariaLabel} preview`}
            role="region"
            className={cn("min-h-0 overflow-auto", layout === "split" && "max-md:hidden")}
          >
            <MessageContent className="mx-auto max-w-3xl px-6 py-6">{value}</MessageContent>
          </div>
        )}
      </div>
    </div>
  );
}
