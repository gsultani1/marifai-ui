// packages/ai-ui/src/components/rich-text-parts.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { toggleMark } from "prosemirror-commands";
import type { MarkType, Node as ProseMirrorNode } from "prosemirror-model";
import { type Command, type EditorState, TextSelection } from "prosemirror-state";
import { addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, deleteColumn, deleteRow, deleteTable, mergeCells, splitCell, toggleHeaderRow } from "prosemirror-tables";
import { type DirectEditorProps, EditorView } from "prosemirror-view";
import { type ReactElement, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type BlockKind, isMarkActive } from "../lib/rich-text/commands.js";
import { findKey, type FindOptions, replaceAll, replaceCurrent } from "../lib/rich-text/plugins.js";
import { usePortalContainer } from "../lib/portal.js";
import { countText } from "../lib/text-stats.js";
import { ActionMenu } from "./action-menu.js";

/*
 * Pieces shared by RichTextEditorView and HtmlEditorView. They import
 * ProseMirror, so only the lazily loaded editor views import this module.
 */

export const EDITOR_CONTENT_CLASS = cn(
  "min-h-48 px-6 py-5 text-[15px] leading-7 whitespace-pre-wrap break-words outline-none [font-variant-ligatures:none]",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:text-lg [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_h6]:text-muted-foreground",
  "[&_p]:my-2 [&>*:first-child]:mt-0",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_li>p]:my-0",
  "[&_ul[data-type=task-list]]:list-none [&_ul[data-type=task-list]]:pl-0.5 [&_li[data-type=task-item]]:flex [&_li[data-type=task-item]]:items-start [&_li[data-type=task-item]]:gap-2 [&_.task-item-check]:mt-1.5 [&_.task-item-check]:flex [&_.task-item-check_input]:size-4 [&_.task-item-check_input]:accent-[var(--primary)] [&_.task-item-content]:min-w-0 [&_.task-item-content]:flex-1 [&_.task-item-content>p]:my-0 [&_li[data-type=task-item]]:my-1 [&_li[data-checked=true]>.task-item-content]:text-muted-foreground [&_li[data-checked=true]>.task-item-content]:line-through",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em]",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-code-background [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:text-code-foreground [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-6 [&_hr]:border-border [&_hr.ProseMirror-selectednode]:border-primary",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
  "[&_mark]:rounded-sm [&_mark]:bg-warning/30 [&_mark]:px-0.5 [&_mark]:text-foreground",
  "[&_table]:my-3 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:relative [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:relative [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_td>p]:my-0 [&_th>p]:my-0 [&_.selectedCell]:bg-primary/10",
  "[&_img]:inline-block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-primary",
  "[&_.find-match]:rounded-sm [&_.find-match]:bg-warning/35 [&_.find-current]:rounded-sm [&_.find-current]:bg-primary/30 [&_.find-current]:outline-1 [&_.find-current]:outline-primary",
  "[&_.is-empty]:before:pointer-events-none [&_.is-empty]:before:float-left [&_.is-empty]:before:h-0 [&_.is-empty]:before:text-muted-foreground [&_.is-empty]:before:content-[attr(data-placeholder)]",
  "[&_.ProseMirror-gapcursor]:pointer-events-none [&_.ProseMirror-gapcursor]:absolute [&_.ProseMirror-gapcursor:after]:absolute [&_.ProseMirror-gapcursor:after]:-top-px [&_.ProseMirror-gapcursor:after]:block [&_.ProseMirror-gapcursor:after]:w-5 [&_.ProseMirror-gapcursor:after]:border-t [&_.ProseMirror-gapcursor:after]:border-foreground [&_.ProseMirror-gapcursor:after]:content-['']",
  "[&.ProseMirror-hideselection_*::selection]:bg-transparent [&.ProseMirror-hideselection]:caret-transparent",
);

export const BLOCK_LABELS: Array<{ kind: BlockKind; label: string; shortcut?: string }> = [
  { kind: "paragraph", label: "Text", shortcut: "Ctrl+Alt+0" },
  { kind: "heading1", label: "Heading 1", shortcut: "Ctrl+Alt+1" },
  { kind: "heading2", label: "Heading 2", shortcut: "Ctrl+Alt+2" },
  { kind: "heading3", label: "Heading 3", shortcut: "Ctrl+Alt+3" },
  { kind: "heading4", label: "Heading 4" },
  { kind: "blockquote", label: "Quote", shortcut: "Ctrl+Shift+B" },
  { kind: "code", label: "Code block" },
];

export const editorTool = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-accent aria-pressed:text-foreground [&_svg]:size-4",
  focusRing,
);

export function ToolbarSeparator() {
  return <Toolbar.Separator className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

export function MarkButton({ label, type, icon, shortcut, state, run, disabled = false }: { label: string; type: MarkType; icon: ReactNode; shortcut?: string; state: EditorState; run: (command: Command) => boolean; disabled?: boolean }) {
  return (
    <Toolbar.Button
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      {...(shortcut ? { "aria-keyshortcuts": shortcut.replace("Ctrl", "Control") } : {})}
      aria-pressed={isMarkActive(state, type)}
      disabled={disabled}
      onClick={() => run(toggleMark(type))}
      className={editorTool}
    >
      {icon}
    </Toolbar.Button>
  );
}

export function docText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n\n", " ");
}

interface BlockCounts {
  words: number;
  characters: number;
  /** Whether `docText` puts a block separator before this block. */
  separated: boolean;
}

const blockCounts = new WeakMap<ProseMirrorNode, BlockCounts>();

function countBlock(block: ProseMirrorNode): BlockCounts {
  const cached = blockCounts.get(block);
  if (cached) return cached;
  let separated = block.isTextblock || block.isLeaf;
  if (!separated)
    block.descendants((node) => {
      if (node.isBlock && (node.isTextblock || node.isLeaf)) separated = true;
      return !separated;
    });
  const text = block.isLeaf ? " " : block.textBetween(0, block.content.size, "\n\n", " ");
  const counts = { ...countText(text), separated };
  blockCounts.set(block, counts);
  return counts;
}

/**
 * The same counts as `countText(docText(doc))`, but blocks are counted once
 * and reused while unchanged, so typing in a long document recounts only the
 * block being edited.
 */
export function docCounts(doc: ProseMirrorNode): { words: number; characters: number } {
  let words = 0;
  let characters = 0;
  let separators = -1;
  doc.forEach((block) => {
    const counts = countBlock(block);
    words += counts.words;
    characters += counts.characters;
    if (counts.separated) separators += 1;
  });
  return { words, characters: characters + 2 * Math.max(0, separators) };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

/** A complete HTML page around exported editor content, with print-friendly defaults; `css` is appended to them. */
export function standaloneHtml(title: string, body: string, css = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111}img,video{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto}blockquote{border-left:4px solid #ddd;margin:0;padding-left:1rem;color:#555}ul[data-type=task-list]{list-style:none;padding-left:0}li[data-checked=true]{text-decoration:line-through;color:#666}li[data-type=task-item]::before{content:"☐ "}li[data-checked=true]::before{content:"☑ "}${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${body}</body></html>`;
}

/** Prints HTML through a hidden frame, which also offers "Save as PDF"; `css` is added to the page styles. */
export function printHtml(title: string, body: string, css = ""): void {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0";
  frame.setAttribute("aria-hidden", "true");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument || !frame.contentWindow) {
    frame.remove();
    return;
  }
  frameDocument.open();
  frameDocument.write(standaloneHtml(title, body, css));
  frameDocument.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
}

/* ------------------------------------------------------------------ */
/* Editor view                                                         */
/* ------------------------------------------------------------------ */

/** Marks transactions that apply a new `value` from props, so they are not reported back. */
export const EXTERNAL_UPDATE = "ai-ui-external-update";

export interface ProseEditorOptions {
  /** Receives the view once mounted. */
  viewRef: RefObject<EditorView | null>;
  /** Builds the starting state; called once. */
  createState: () => EditorState;
  /** Controlled content; when it changes from outside, the document is replaced without an undo step. */
  value: string | undefined;
  initialValue: string;
  parse: (value: string) => ProseMirrorNode;
  serialize: (doc: ProseMirrorNode) => string;
  readOnly: boolean;
  autoFocus: boolean;
  /** Called after every user change with the serialized document. */
  onChange: (serialized: string, state: EditorState) => void;
  /** Extra view props, read once on mount. */
  viewProps?: Omit<DirectEditorProps, "state" | "dispatchTransaction" | "editable">;
  /** Called after every transaction, including selection changes. */
  onTransaction?: (view: EditorView) => void;
  /** DOM events raised on the editor root (see RICH_TEXT_EVENTS), read once on mount. */
  events?: Array<[string, () => void]>;
}

/**
 * Owns a ProseMirror view: creates it once, mirrors its state into React,
 * serializes on change, follows a controlled value without echoing it back,
 * and toggles editability.
 */
export function useProseEditor({ viewRef, createState, value, initialValue, parse, serialize, readOnly, autoFocus, onChange, viewProps, onTransaction, events }: ProseEditorOptions) {
  const mountRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value ?? initialValue);
  const latest = useRef({ parse, serialize, onChange, onTransaction });
  const setup = useRef({ viewProps, events, autoFocus });
  const readOnlyRef = useRef(readOnly);
  const [initialState] = useState(createState);
  const [editorState, setEditorState] = useState(initialState);

  useEffect(() => {
    latest.current = { parse, serialize, onChange, onTransaction };
  }, [parse, serialize, onChange, onTransaction]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const { viewProps: props, events: listeners = [], autoFocus: focus } = setup.current;
    const view: EditorView = new EditorView(
      { mount },
      {
        ...props,
        state: initialState,
        editable: () => !readOnlyRef.current,
        dispatchTransaction: (tr) => {
          const next = view.state.apply(tr);
          view.updateState(next);
          setEditorState(next);
          latest.current.onTransaction?.(view);
          if (!tr.docChanged || tr.getMeta(EXTERNAL_UPDATE)) return;
          const serialized = latest.current.serialize(next.doc);
          lastValue.current = serialized;
          latest.current.onChange(serialized, next);
        },
      },
    );
    viewRef.current = view;
    if (focus) view.focus();
    for (const [name, listener] of listeners) mount.addEventListener(name, listener);
    return () => {
      for (const [name, listener] of listeners) mount.removeEventListener(name, listener);
      view.destroy();
      viewRef.current = null;
    };
  }, [initialState, viewRef]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
    viewRef.current?.setProps({});
  }, [readOnly, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === undefined || value === lastValue.current) return;
    lastValue.current = value;
    const doc = latest.current.parse(value);
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content).setMeta("addToHistory", false).setMeta(EXTERNAL_UPDATE, true));
  }, [value, viewRef]);

  const run = (command: Command) => {
    const view = viewRef.current;
    if (!view) return false;
    const result = command(view.state, view.dispatch, view);
    view.focus();
    return result;
  };

  /** Replaces the whole document as one undoable change. */
  const replaceContent = (content: string) => {
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, latest.current.parse(content).content));
  };

  return { mountRef, editorState, run, replaceContent, lastValue };
}

/* ------------------------------------------------------------------ */
/* Dialogs and bars                                                    */
/* ------------------------------------------------------------------ */

export interface UrlDialogField {
  name: string;
  label: string;
  initial?: string;
  placeholder?: string;
  type?: "text" | "number";
}

export function UrlDialog({
  open,
  onOpenChange,
  trigger,
  title,
  fields,
  submitLabel,
  onSubmit,
  onRemove,
  validate,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  title: string;
  fields: UrlDialogField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => boolean;
  onRemove?: () => void;
  validate: (values: Record<string, string>) => string | null;
  /** Shown after the fields, e.g. an upload button. */
  extra?: ReactNode;
}) {
  const container = usePortalContainer();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [shownOpen, setShownOpen] = useState(false);
  const id = useId();
  // Refill the fields every time the dialog opens, including when an editor event opens it.
  if (open !== shownOpen) {
    setShownOpen(open);
    if (open) {
      setValues(Object.fromEntries(fields.map((field) => [field.name, field.initial ?? ""])));
      setError(null);
    }
  }
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger render={trigger} />
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className={cn(popupSurface, "w-72 p-3 text-sm outline-none")}>
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const problem = validate(values);
                if (problem) {
                  setError(problem);
                  return;
                }
                if (onSubmit(values)) onOpenChange(false);
              }}
            >
              <Popover.Title className="font-medium">{title}</Popover.Title>
              {fields.map((field, index) => (
                <label key={field.name} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  <input
                    autoFocus={index === 0}
                    type={field.type ?? "text"}
                    {...(field.type === "number" ? { min: 16, inputMode: "numeric" as const } : {})}
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    aria-invalid={error && index === 0 ? true : undefined}
                    aria-describedby={error && index === 0 ? `${id}-error` : undefined}
                    onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                    className={cn("h-8 rounded-md border border-input bg-background px-2", focusRing)}
                  />
                </label>
              ))}
              {extra}
              {error && (
                <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemove();
                      onOpenChange(false);
                    }}
                    className={cn("mr-auto h-8 rounded-md px-2 text-destructive hover:bg-destructive/10", focusRing)}
                  >
                    Remove
                  </button>
                )}
                <button type="submit" className={cn("h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground", focusRing)}>
                  {submitLabel}
                </button>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The table editing menu shown while the cursor is in a table. */
export function TableMenu({ state, run }: { state: EditorState; run: (command: Command) => boolean }) {
  return (
    <ActionMenu
      trigger={<Toolbar.Button className={cn(editorTool, "w-auto px-2 text-xs")}>Table</Toolbar.Button>}
      items={[
        { id: "row-before", label: "Insert row above", onSelect: () => run(addRowBefore) },
        { id: "row-after", label: "Insert row below", onSelect: () => run(addRowAfter) },
        { id: "col-before", label: "Insert column left", onSelect: () => run(addColumnBefore) },
        { id: "col-after", label: "Insert column right", onSelect: () => run(addColumnAfter) },
        { type: "separator", id: "s1" },
        { id: "header", label: "Toggle header row", onSelect: () => run(toggleHeaderRow) },
        { id: "merge", label: "Merge cells", disabled: !mergeCells(state), onSelect: () => run(mergeCells) },
        { id: "split", label: "Split cell", disabled: !splitCell(state), onSelect: () => run(splitCell) },
        { type: "separator", id: "s2" },
        { id: "delete-row", label: "Delete row", destructive: true, onSelect: () => run(deleteRow) },
        { id: "delete-col", label: "Delete column", destructive: true, onSelect: () => run(deleteColumn) },
        { id: "delete-table", label: "Delete table", destructive: true, onSelect: () => run(deleteTable) },
      ]}
    />
  );
}

/**
 * Find and replace bar. Stays mounted while closed so the query and options
 * survive; reopening runs the last query again.
 */
export function FindBar({ open, onClose, viewRef, state, readOnly, inputRef }: { open: boolean; onClose: () => void; viewRef: RefObject<EditorView | null>; state: EditorState; readOnly: boolean; inputRef: RefObject<HTMLInputElement | null> }) {
  const [options, setOptions] = useState<FindOptions>({ query: "", caseSensitive: false, wholeWord: false, regex: false });
  const [replacement, setReplacement] = useState("");
  const [keepCase, setKeepCase] = useState(false);
  const find = findKey.getState(state);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const view = viewRef.current;
    if (open && view && optionsRef.current.query) view.dispatch(view.state.tr.setMeta(findKey, { type: "set", options: optionsRef.current }));
  }, [open, viewRef]);

  if (!open) return null;

  const update = (next: FindOptions) => {
    setOptions(next);
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta(findKey, { type: "set", options: next }));
  };

  const gotoMatch = (delta: number) => {
    const view = viewRef.current;
    const current = view ? findKey.getState(view.state) : undefined;
    if (!view || !current?.matches.length) return;
    const index = (current.current + delta + current.matches.length) % current.matches.length;
    const match = current.matches[index]!;
    view.dispatch(view.state.tr.setMeta(findKey, { type: "current", index }).setSelection(TextSelection.create(view.state.doc, match.from, match.to)).scrollIntoView());
  };

  const small = cn("h-7 rounded-md px-2 hover:bg-accent disabled:opacity-40", focusRing);
  return (
    <div role="search" aria-label="Find and replace" className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5 text-sm">
      <input
        ref={inputRef}
        type="search"
        aria-label="Find"
        placeholder="Find"
        value={options.query}
        aria-invalid={find?.error ? true : undefined}
        onChange={(event) => update({ ...options, query: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            gotoMatch(event.shiftKey ? -1 : 1);
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        className={cn("h-7 w-40 rounded-md border border-input bg-background px-2", focusRing)}
      />
      <input
        aria-label="Replace with"
        placeholder="Replace with"
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
        className={cn("h-7 w-40 rounded-md border border-input bg-background px-2", focusRing)}
      />
      <span aria-live="polite" className="min-w-16 text-xs text-muted-foreground tabular-nums">
        {find?.error ? "Invalid pattern" : options.query ? (find?.matches.length ? `${(find.current ?? 0) + 1} of ${find.matches.length}` : "No results") : ""}
      </span>
      {(
        [
          ["caseSensitive", "Match case"],
          ["wholeWord", "Whole word"],
          ["regex", "Regex"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={options[key]} onChange={(event) => update({ ...options, [key]: event.target.checked })} className={cn("size-3.5 accent-primary", focusRing)} />
          {label}
        </label>
      ))}
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={keepCase} onChange={(event) => setKeepCase(event.target.checked)} className={cn("size-3.5 accent-primary", focusRing)} />
        Preserve case
      </label>
      <span className="ml-auto flex gap-1">
        <button type="button" onClick={() => gotoMatch(-1)} disabled={!find?.matches.length} className={small}>
          Previous
        </button>
        <button type="button" onClick={() => gotoMatch(1)} disabled={!find?.matches.length} className={small}>
          Next
        </button>
        {!readOnly && (
          <>
            <button type="button" onClick={() => viewRef.current && replaceCurrent(viewRef.current, replacement, keepCase)} disabled={!find?.matches.length} className={small}>
              Replace
            </button>
            <button type="button" onClick={() => viewRef.current && replaceAll(viewRef.current, replacement, keepCase)} disabled={!find?.matches.length} className={small}>
              Replace all
            </button>
          </>
        )}
        <button type="button" onClick={onClose} className={cn("h-7 rounded-md px-2 hover:bg-accent", focusRing)}>
          Close
        </button>
      </span>
    </div>
  );
}

/** Open state for the find bar: opening focuses and selects the query, closing clears the highlights and refocuses the document. */
export function useFindToggle(viewRef: RefObject<EditorView | null>) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const show = () => {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const close = () => {
    setOpen(false);
    const view = viewRef.current;
    if (view) {
      view.dispatch(view.state.tr.setMeta(findKey, { type: "clear" }));
      view.focus();
    }
  };
  return { open, show, close, inputRef };
}
