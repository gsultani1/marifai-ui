// packages/ai-ui/src/components/html-editor-extension.ts
import type { Command, EditorState, Plugin } from "prosemirror-state";
import type { EditorView, NodeViewConstructor } from "prosemirror-view";
import type { ComponentType, ReactNode, RefObject } from "react";

import type { HtmlEditorViewProps } from "./html-editor-view.js";

/** Transaction meta HtmlEditorView sets when props that plugins read change (layout, page size, header, footer, title, review state, comments, read-only), so plugins can recompute decorations. */
export const HTML_EDITOR_PROPS_META = "ai-ui-html-editor-props";

/** What an extension receives when HtmlEditorView creates it, once per editor. */
export interface HtmlEditorExtensionSetup {
  /** The view once mounted, or null. */
  getView: () => EditorView | null;
  /** The editor's latest props; plugins read options here instead of capturing them. */
  getProps: () => HtmlEditorViewProps;
  /** Shows a message in the status line, announced politely. */
  setStatus: (message: string) => void;
}

/** An entry in the slash menu, and optionally in a block's "Turn into" menu. */
export interface HtmlSlashItem {
  id: string;
  label: string;
  description?: string;
  /** Extra words the filter matches, e.g. "h1" for "Heading 1". */
  keywords?: string[];
  icon?: ReactNode;
  /** Section heading in the menu, e.g. "Basic blocks", "Media", "Layout". */
  group: string;
  /** Inserts or converts at the selection; the slash text is already removed. */
  run: (view: EditorView) => void;
  /** Also offered under "Turn into", run with the cursor inside the block to convert. */
  turnInto?: boolean;
}

/** Props every extension component receives on each render. */
export interface HtmlEditorRenderProps {
  state: EditorState;
  viewRef: RefObject<EditorView | null>;
  /** Runs a command against the view and refocuses it. */
  run: (command: Command) => boolean;
  readOnly: boolean;
  /** True while the HTML source view replaces the document. */
  locked: boolean;
  props: HtmlEditorViewProps;
  /** The scrolling document surface (position: relative). Overlays are its children and use content coordinates. */
  surfaceRef: RefObject<HTMLDivElement | null>;
  setStatus: (message: string) => void;
  /** Slash and turn-into items from every extension. */
  slashItems: HtmlSlashItem[];
  /** Every extension's Bubble component, for the selection toolbar to render. */
  bubbleItems: ReactNode;
}

/**
 * A feature of HtmlEditorView. Plugins and node views are installed once;
 * components render on every editor update. The host skips all components
 * when `compact` is set, and plugins must do nothing then
 * (`setup.getProps().compact`).
 */
export interface HtmlEditorExtension {
  name: string;
  /** Installed ahead of the base keymaps, so their key handlers win. */
  plugins?: Plugin[];
  nodeViews?: Record<string, NodeViewConstructor>;
  slashItems?: HtmlSlashItem[];
  /** Classes for the scrolling document surface, e.g. a page background. */
  surfaceClassName?: (props: HtmlEditorViewProps) => string | undefined;
  /** Controls appended to the main toolbar. */
  Toolbar?: ComponentType<HtmlEditorRenderProps>;
  /** A layer inside the document surface, for handles, menus and page chrome. */
  Overlay?: ComponentType<HtmlEditorRenderProps>;
  /** Buttons inside the selection toolbar. */
  Bubble?: ComponentType<HtmlEditorRenderProps>;
  /** A panel beside the document, such as comments or the list of changes. */
  Aside?: ComponentType<HtmlEditorRenderProps>;
  /** Items in the status bar. */
  Status?: ComponentType<HtmlEditorRenderProps>;
}

/**
 * Where a document position sits inside the scrolling surface, in content
 * coordinates (scroll offsets included), for absolutely positioned overlays.
 */
export function surfacePosition(view: EditorView, surface: HTMLElement, pos: number, side: -1 | 1 = 1): { left: number; top: number; bottom: number } {
  const box = surface.getBoundingClientRect();
  const coords = view.coordsAtPos(pos, side);
  return { left: coords.left - box.left + surface.scrollLeft, top: coords.top - box.top + surface.scrollTop, bottom: coords.bottom - box.top + surface.scrollTop };
}

/** What HtmlEditorView sends to `onAiRequest`. */
export interface HtmlAiRequest {
  /** The action's id, e.g. "rewrite", "shorten", "tone-friendly", "continue" or "custom". */
  action: string;
  /** The instruction for the model, already phrased, e.g. "Rewrite this text to be clearer." */
  instruction: string;
  /** The selected text, or "" when continuing at the cursor. */
  text: string;
  /** The selected content as sanitized HTML. */
  html: string;
  /** Plain text just before and after the selection, for context. */
  before: string;
  after: string;
  /** What the person typed, for custom requests. */
  prompt?: string;
}

/** A preset in the AI menu. */
export interface HtmlAiAction {
  id: string;
  label: string;
  instruction: string;
  /** Menu section, e.g. "Edit", "Tone" or "Write". */
  group?: string;
  /** "selection" needs selected text; "cursor" writes at the cursor. Defaults to "selection". */
  scope?: "selection" | "cursor";
}

/**
 * Streams or returns the model's text for an AI request. Return an async
 * iterable of chunks to show text as it arrives, or a promise of the whole
 * text. Stop the work when `signal` aborts.
 */
export type HtmlAiHandler = (request: HtmlAiRequest, signal: AbortSignal) => AsyncIterable<string> | Promise<string>;
