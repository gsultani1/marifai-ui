// packages/ai-ui/src/components/html-editor-ai.tsx
"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import {
  BadgeCheckIcon,
  BriefcaseIcon,
  CheckIcon,
  CircleAlertIcon,
  CoffeeIcon,
  GitCompareArrowsIcon,
  ListPlusIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  Minimize2Icon,
  PenLineIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  SmileIcon,
  SparklesIcon,
  SpellCheckIcon,
  SquareIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { closeHistory } from "prosemirror-history";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { aiParagraphs, aiSelectionRange, buildAiRequest, collectAiText, DEFAULT_HTML_AI_ACTIONS, type HtmlAiInsertMode, htmlAiKey, type HtmlAiMeta, htmlAiPlugin, type HtmlAiRange, insertAiText } from "../lib/rich-text/html-ai.js";
import { safeAuthor } from "../lib/rich-text/html.js";
import type { HtmlAiAction, HtmlEditorExtension, HtmlEditorExtensionSetup, HtmlEditorRenderProps } from "./html-editor-extension.js";
import type { HtmlEditorViewProps } from "./html-editor-view.js";
import { editorTool, ToolbarSeparator } from "./rich-text-parts.js";

const CUSTOM_ACTION = "custom";
const DEFAULT_AUTHOR = "AI assistant";

type AiPhase = "running" | "done" | "error";

interface AiMenu extends HtmlAiRange {
  hasText: boolean;
  /** Where focus goes when the menu closes; the editor when null. */
  returnFocus: HTMLElement | null;
}

interface AiSession extends HtmlAiRange {
  key: number;
  action: HtmlAiAction;
  prompt: string | undefined;
  scope: "selection" | "cursor";
  phase: AiPhase;
  text: string;
  error: string;
  /** Stop was pressed after some text arrived. */
  stopped: boolean;
}

interface AiSnapshot {
  menu: AiMenu | null;
  session: AiSession | null;
}

interface AiController {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AiSnapshot;
  enabled: () => boolean;
  openMenu: (view: EditorView, returnFocus: HTMLElement | null) => boolean;
  closeMenu: (restoreFocus: boolean) => void;
  start: (action: HtmlAiAction, prompt?: string) => void;
  retry: () => void;
  stop: () => void;
  accept: (mode: HtmlAiInsertMode) => void;
  discard: (restoreFocus: boolean) => void;
  escape: (view: EditorView) => boolean;
  reset: () => void;
  lost: () => void;
}

function isEnabled(props: HtmlEditorViewProps): boolean {
  return Boolean(props.onAiRequest) && !props.compact && !props.readOnly;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error && reason.message ? reason.message : "";
}

/** Owns the menu and the running request for one editor; components subscribe to its snapshot. */
function createAiController(setup: HtmlEditorExtensionSetup): AiController {
  let snapshot: AiSnapshot = { menu: null, session: null };
  const listeners = new Set<() => void>();
  let abort: AbortController | null = null;
  let counter = 0;

  const set = (patch: Partial<AiSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const enabled = () => isEnabled(setup.getProps());
  const cancel = () => {
    abort?.abort();
    abort = null;
  };
  const clearTarget = (view: EditorView | null) => {
    if (view && htmlAiKey.getState(view.state)) view.dispatch(view.state.tr.setMeta(htmlAiKey, { type: "clear" } satisfies HtmlAiMeta));
  };
  const updateSession = (key: number, patch: Partial<AiSession>) => {
    if (snapshot.session?.key === key) set({ session: { ...snapshot.session, ...patch } });
  };

  const discard = (restoreFocus: boolean) => {
    cancel();
    const view = setup.getView();
    const open = Boolean(snapshot.menu || snapshot.session);
    set({ menu: null, session: null });
    clearTarget(view);
    if (restoreFocus && open) view?.focus();
  };

  const finish = (key: number, controller: AbortController, text: string, failure: { reason: unknown } | null) => {
    if (snapshot.session?.key !== key) return;
    if (abort === controller) abort = null;
    if (controller.signal.aborted) {
      if (text.trim()) updateSession(key, { phase: "done", text, stopped: true });
      else discard(true);
      return;
    }
    if (failure) updateSession(key, { phase: "error", error: errorMessage(failure.reason) });
    else if (!text.trim()) updateSession(key, { phase: "error", error: "No suggestion came back." });
    else updateSession(key, { phase: "done", text });
  };

  const begin = (view: EditorView, action: HtmlAiAction, prompt: string | undefined, range: HtmlAiRange) => {
    const handler = setup.getProps().onAiRequest;
    if (!handler || !enabled()) return;
    cancel();
    const controller = new AbortController();
    abort = controller;
    counter += 1;
    const key = counter;
    const scope = (action.scope ?? "selection") === "cursor" || range.from === range.to ? "cursor" : "selection";
    const target = scope === "cursor" ? { from: range.to, to: range.to } : range;
    const request = buildAiRequest(view.state, target, action, prompt);
    set({ menu: null, session: { key, action, prompt, scope, ...target, phase: "running", text: "", error: "", stopped: false } });
    view.dispatch(view.state.tr.setMeta(htmlAiKey, { type: "set", target: { ...target, mode: "preview" } } satisfies HtmlAiMeta));
    let result: ReturnType<typeof handler>;
    try {
      result = handler(request, controller.signal);
    } catch (reason) {
      result = Promise.reject(reason instanceof Error ? reason : new Error(String(reason)));
    }
    collectAiText(result, controller.signal, (text) => updateSession(key, { text })).then(
      (text) => finish(key, controller, text, null),
      (reason: unknown) => finish(key, controller, snapshot.session?.key === key ? snapshot.session.text : "", { reason }),
    );
  };

  const closeMenu = (restoreFocus: boolean) => {
    const menu = snapshot.menu;
    if (!menu) return;
    const view = setup.getView();
    set({ menu: null });
    if (!snapshot.session) clearTarget(view);
    if (!restoreFocus) return;
    if (menu.returnFocus?.isConnected) menu.returnFocus.focus();
    else view?.focus();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    enabled,
    openMenu: (view, returnFocus) => {
      if (!enabled() || !view.editable) return false;
      cancel();
      const range = aiSelectionRange(view.state);
      set({ session: null, menu: { ...range, returnFocus } });
      view.dispatch(view.state.tr.setMeta(htmlAiKey, { type: "set", target: { from: range.from, to: range.to, mode: "menu" } } satisfies HtmlAiMeta));
      return true;
    },
    closeMenu,
    start: (action, prompt) => {
      const view = setup.getView();
      const menu = snapshot.menu;
      if (!view || !menu) return;
      const cursor = (action.scope ?? "selection") === "cursor";
      if (!cursor && !menu.hasText) return;
      const target = htmlAiKey.getState(view.state) ?? menu;
      begin(view, action, prompt, { from: target.from, to: target.to });
    },
    retry: () => {
      const view = setup.getView();
      const session = snapshot.session;
      if (!view || !session) return;
      const target = htmlAiKey.getState(view.state) ?? session;
      begin(view, session.action, session.prompt, { from: target.from, to: target.to });
    },
    stop: () => abort?.abort(),
    accept: (mode) => {
      const view = setup.getView();
      const session = snapshot.session;
      const props = setup.getProps();
      if (!view || !session || session.phase !== "done" || (mode === "suggest" && !props.review)) return;
      const target = htmlAiKey.getState(view.state) ?? session;
      const tr = insertAiText(view.state, target, session.text, mode, { author: safeAuthor(props.author) || DEFAULT_AUTHOR, date: new Date().toISOString() });
      set({ session: null });
      if (!tr) {
        clearTarget(view);
        view.focus();
        return;
      }
      view.dispatch(closeHistory(tr.setMeta(htmlAiKey, { type: "clear" } satisfies HtmlAiMeta).scrollIntoView()));
      view.focus();
      setup.setStatus(
        mode === "suggest" ? "Added the AI suggestion as a tracked change" : mode === "below" ? "Inserted the AI suggestion below" : session.scope === "cursor" ? "Inserted the AI text at the cursor" : "Replaced the text with the AI suggestion",
      );
    },
    discard,
    escape: (view) => {
      if (snapshot.menu) closeMenu(true);
      else if (snapshot.session) discard(true);
      else clearTarget(view);
      return true;
    },
    reset: () => {
      if (!snapshot.menu && !snapshot.session) return;
      cancel();
      set({ menu: null, session: null });
      clearTarget(setup.getView());
    },
    lost: () => {
      const session = snapshot.session;
      if (!snapshot.menu && !session) return;
      cancel();
      set({ menu: null, session: null });
      if (session) setup.setStatus("AI suggestion discarded");
    },
  };
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function useAi(ai: AiController): AiSnapshot {
  return useSyncExternalStore(ai.subscribe, ai.getSnapshot, ai.getSnapshot);
}

function shortcut(): { label: string; aria: string } {
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  return apple ? { label: "⌘J", aria: "Meta+J" } : { label: "Ctrl+J", aria: "Control+J" };
}

const ACTION_ICONS: Record<string, ReactNode> = {
  rewrite: <WandSparklesIcon aria-hidden="true" />,
  fix: <SpellCheckIcon aria-hidden="true" />,
  shorten: <Minimize2Icon aria-hidden="true" />,
  expand: <Maximize2Icon aria-hidden="true" />,
  "tone-professional": <BriefcaseIcon aria-hidden="true" />,
  "tone-friendly": <SmileIcon aria-hidden="true" />,
  "tone-confident": <BadgeCheckIcon aria-hidden="true" />,
  "tone-casual": <CoffeeIcon aria-hidden="true" />,
  continue: <PenLineIcon aria-hidden="true" />,
  summarize: <ScrollTextIcon aria-hidden="true" />,
};

const SURFACE_CLASS = [
  "[&_.html-ai-target]:rounded-sm [&_.html-ai-target]:bg-primary/15 [&_.html-ai-target]:box-decoration-clone",
  "[&_.html-ai-cursor]:-mr-0.5 [&_.html-ai-cursor]:inline-block [&_.html-ai-cursor]:h-[1.2em] [&_.html-ai-cursor]:w-0.5 [&_.html-ai-cursor]:rounded-full [&_.html-ai-cursor]:bg-primary [&_.html-ai-cursor]:align-text-bottom",
].join(" ");

const panelSurface = "absolute z-30 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg";
const smallButton = cn(button, "h-7 max-w-full min-w-0 px-2.5 text-xs", focusRing);

/** Puts an overlay just below a document range, in surface content coordinates, kept inside the surface's width. */
function placeBelow(element: HTMLElement, view: EditorView, surface: HTMLElement, range: HtmlAiRange): void {
  const size = view.state.doc.content.size;
  let start: { left: number; bottom: number };
  let end: { bottom: number };
  try {
    start = view.coordsAtPos(Math.min(range.from, size), 1);
    end = view.coordsAtPos(Math.min(range.to, size), -1);
  } catch {
    return;
  }
  const box = surface.getBoundingClientRect();
  const maxLeft = Math.max(8, surface.clientWidth - element.offsetWidth - 8);
  element.style.left = `${Math.round(Math.max(8, Math.min(start.left - box.left + surface.scrollLeft, maxLeft)))}px`;
  element.style.top = `${Math.round(Math.max(start.bottom, end.bottom) - box.top + surface.scrollTop + 6)}px`;
}

/** Keeps an overlay below its range as the document, the surface or the window changes. */
function useBelowRange(ref: RefObject<HTMLElement | null>, viewRef: RefObject<EditorView | null>, surfaceRef: RefObject<HTMLDivElement | null>, range: HtmlAiRange, state: EditorState) {
  const [layout, setLayout] = useState(0);
  const { from, to } = range;
  useLayoutEffect(() => {
    const element = ref.current;
    const view = viewRef.current;
    const surface = surfaceRef.current;
    if (element && view && surface) placeBelow(element, view, surface, { from, to });
  }, [ref, viewRef, surfaceRef, from, to, state, layout]);
  useEffect(() => {
    const relayout = () => setLayout((value) => value + 1);
    window.addEventListener("resize", relayout);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(relayout);
    const content = viewRef.current?.dom;
    if (content) observer?.observe(content);
    if (ref.current) observer?.observe(ref.current);
    return () => {
      window.removeEventListener("resize", relayout);
      observer?.disconnect();
    };
  }, [ref, viewRef]);
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

interface MenuOption {
  id: string;
  action: HtmlAiAction;
  disabled: boolean;
}

interface MenuGroup {
  label: string;
  options: MenuOption[];
}

function menuGroups(actions: readonly HtmlAiAction[], query: string, hasText: boolean): MenuGroup[] {
  const needle = query.trim().toLowerCase();
  const groups: MenuGroup[] = [];
  if (needle) groups.push({ label: "", options: [{ id: CUSTOM_ACTION, action: { id: CUSTOM_ACTION, label: "Ask AI", instruction: query.trim(), scope: hasText ? "selection" : "cursor" }, disabled: false }] });
  for (const action of actions) {
    const group = action.group ?? "Actions";
    if (needle && !action.label.toLowerCase().includes(needle) && !group.toLowerCase().includes(needle)) continue;
    const option = { id: action.id, action, disabled: (action.scope ?? "selection") === "selection" && !hasText };
    const existing = groups.find((entry) => entry.label === group);
    if (existing) existing.options.push(option);
    else groups.push({ label: group, options: [option] });
  }
  return groups;
}

function firstEnabled(groups: MenuGroup[]): string | null {
  for (const group of groups) for (const option of group.options) if (!option.disabled) return option.id;
  return null;
}

interface AiMenuPanelProps {
  ai: AiController;
  menu: AiMenu;
  actions: readonly HtmlAiAction[];
  viewRef: RefObject<EditorView | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  state: EditorState;
}

/** The prompt field and preset list: a combobox with a grouped listbox, driven from the field with the arrow keys and Enter. */
function AiMenuPanel({ ai, menu, actions, viewRef, surfaceRef, state }: AiMenuPanelProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(() => firstEnabled(menuGroups(actions, "", menu.hasText)));
  const groups = menuGroups(actions, query, menu.hasText);
  const options = groups.flatMap((group) => group.options);
  const enabledOptions = options.filter((option) => !option.disabled);
  const optionId = (index: number) => `${id}-option-${index}`;
  const activeIndex = options.findIndex((option) => option.id === active && !option.disabled);
  const hint = !menu.hasText && options.some((option) => option.disabled);

  useBelowRange(panelRef, viewRef, surfaceRef, menu, state);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView?.({ block: "nearest" });
  }, []);

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [id, activeIndex]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      const panel = panelRef.current;
      if (!(target instanceof Node) || !panel || panel.contains(target)) return;
      const trigger = target instanceof Element ? target.closest("[data-html-ai-trigger]") : null;
      if (trigger && trigger.closest('[data-slot="html-editor"]') === panel.closest('[data-slot="html-editor"]')) return;
      ai.closeMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [ai]);

  const run = (option: MenuOption | undefined) => {
    if (!option || option.disabled) return;
    ai.start(option.action, option.id === CUSTOM_ACTION ? query.trim() : undefined);
  };

  const move = (step: 1 | -1) => {
    if (!enabledOptions.length) return;
    const current = enabledOptions.findIndex((option) => option.id === active);
    const next = current < 0 ? (step > 0 ? 0 : enabledOptions.length - 1) : (current + step + enabledOptions.length) % enabledOptions.length;
    setActive(enabledOptions[next]!.id);
  };

  return (
    <div
      ref={panelRef}
      role="group"
      aria-label="Ask AI"
      data-slot="html-ai-menu"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) ai.closeMenu(false);
      }}
      className={cn(panelSurface, "flex w-80 max-w-[calc(100%-1rem)] flex-col overflow-hidden text-sm")}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 focus-within:bg-accent/40">
        <SparklesIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Ask AI to edit or write"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          autoComplete="off"
          spellCheck
          placeholder="Ask AI to edit or write…"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setActive(value.trim() ? CUSTOM_ACTION : firstEnabled(menuGroups(actions, "", menu.hasText)));
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              move(event.key === "ArrowDown" ? 1 : -1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(options[activeIndex]);
            } else if (event.key === "Escape" || ((event.key === "j" || event.key === "J") && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey)) {
              event.preventDefault();
              event.stopPropagation();
              ai.closeMenu(true);
            }
          }}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="px-3 pt-2 text-xs text-muted-foreground">
          Select text to use the actions that change it.
        </p>
      )}
      <div id={`${id}-list`} role="listbox" aria-label="AI actions" className="max-h-72 overflow-y-auto p-1">
        {groups.map((group, groupIndex) => {
          const items = group.options.map((option) => {
            const index = options.indexOf(option);
            const selected = index === activeIndex;
            const custom = option.id === CUSTOM_ACTION;
            return (
              <div
                key={`${index}-${option.id}`}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(option)}
                onPointerMove={() => {
                  if (!option.disabled && active !== option.id) setActive(option.id);
                }}
                className={cn(
                  "flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 py-1 select-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
                  selected && "bg-accent text-accent-foreground",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {custom ? <SparklesIcon aria-hidden="true" /> : (ACTION_ICONS[option.id] ?? <SparklesIcon aria-hidden="true" />)}
                {custom ? (
                  <span className="min-w-0 truncate">
                    Ask AI <span className="text-muted-foreground">“{query.trim()}”</span>
                  </span>
                ) : (
                  <span className="min-w-0 truncate">{option.action.label}</span>
                )}
              </div>
            );
          });
          if (!group.label) return items;
          const labelId = `${id}-group-${groupIndex}`;
          return (
            <div key={group.label} role="group" aria-labelledby={labelId}>
              <div id={labelId} role="presentation" className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </div>
              {items}
            </div>
          );
        })}
        {options.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Type what you want, then press Enter.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

interface AiPreviewPanelProps {
  ai: AiController;
  session: AiSession;
  review: boolean;
  viewRef: RefObject<EditorView | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  state: EditorState;
}

/** The suggestion streaming in below its range, with Stop while it runs and the ways to use it once it is done. */
function AiPreviewPanel({ ai, session, review, viewRef, surfaceRef, state }: AiPreviewPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const { phase, key } = session;
  const running = phase === "running";
  const summarize = session.action.id === "summarize" && session.scope === "selection";
  const paragraphs = aiParagraphs(session.text);
  const title = session.action.id === CUSTOM_ACTION ? `“${session.prompt ?? session.action.instruction}”` : session.action.label;
  const primaryLabel = summarize ? "Insert below" : session.scope === "cursor" ? "Insert at cursor" : "Replace";
  const announcement = phase === "done" ? (session.stopped ? "Stopped. Suggestion ready." : "Suggestion ready.") : phase === "error" ? `Couldn't get a suggestion. ${session.error}` : "";

  useBelowRange(panelRef, viewRef, surfaceRef, session, state);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focused = document.activeElement;
    if (!focused || focused === document.body || panel.contains(focused)) (phase === "running" ? stopRef : phase === "done" ? primaryRef : retryRef).current?.focus({ preventScroll: true });
    panel.scrollIntoView?.({ block: "nearest" });
  }, [phase, key]);

  return (
    <section
      ref={panelRef}
      aria-label="AI suggestion"
      data-slot="html-ai-preview"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        ai.discard(true);
      }}
      className={cn(panelSurface, "flex w-[min(38rem,calc(100%-1rem))] flex-col gap-2 p-3 text-sm")}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
        <SparklesIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{title}</span>
        {running && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <LoaderCircleIcon aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
            Writing…
          </span>
        )}
        {phase === "done" && session.stopped && <span className="ml-auto shrink-0">Stopped early</span>}
      </div>
      {(paragraphs.length > 0 || running) && (
        <div
          role="region"
          aria-label="Suggested text"
          aria-busy={running}
          tabIndex={0}
          className={cn("max-h-60 overflow-y-auto rounded-md border border-border bg-background px-3 py-2 leading-6 whitespace-pre-wrap text-foreground", focusRing)}
        >
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => (
              <p key={index} className="my-2 first:mt-0 last:mb-0">
                {paragraph}
              </p>
            ))
          ) : (
            <span className="text-muted-foreground">Writing…</span>
          )}
        </div>
      )}
      {phase === "error" && (
        <div className="flex items-start gap-2 text-destructive">
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0">
            <span className="font-medium">Couldn't get a suggestion.</span> {session.error}
          </p>
        </div>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {running && (
          <button ref={stopRef} type="button" onClick={ai.stop} className={cn(smallButton, buttonVariants.outline)}>
            <SquareIcon aria-hidden="true" className="!size-3 fill-current" />
            <span className="truncate">Stop</span>
          </button>
        )}
        {phase === "done" && (
          <>
            <button ref={primaryRef} type="button" onClick={() => ai.accept(summarize ? "below" : "replace")} className={cn(smallButton, buttonVariants.primary)}>
              {summarize ? <ListPlusIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
              <span className="truncate">{primaryLabel}</span>
            </button>
            <button type="button" onClick={() => ai.accept(summarize ? "replace" : "below")} className={cn(smallButton, buttonVariants.outline)}>
              {summarize ? <CheckIcon aria-hidden="true" /> : <ListPlusIcon aria-hidden="true" />}
              <span className="truncate">{summarize ? "Replace" : "Insert below"}</span>
            </button>
            {review && (
              <button type="button" onClick={() => ai.accept("suggest")} className={cn(smallButton, buttonVariants.outline)}>
                <GitCompareArrowsIcon aria-hidden="true" />
                <span className="truncate">Suggest as change</span>
              </button>
            )}
          </>
        )}
        {!running && (
          <>
            <button ref={retryRef} type="button" onClick={ai.retry} className={cn(smallButton, buttonVariants.ghost)}>
              <RotateCcwIcon aria-hidden="true" />
              <span className="truncate">Try again</span>
            </button>
            <button type="button" onClick={() => ai.discard(true)} className={cn(smallButton, buttonVariants.ghost)}>
              <XIcon aria-hidden="true" />
              <span className="truncate">Discard</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

type AiRenderProps = HtmlEditorRenderProps & { ai: AiController };

function AiToolbarButton({ ai, viewRef, props, readOnly, locked }: AiRenderProps) {
  const { menu } = useAi(ai);
  if (!isEnabled(props) || readOnly) return null;
  const keys = shortcut();
  const open = menu !== null;
  return (
    <>
      <ToolbarSeparator />
      <Toolbar.Button
        data-html-ai-trigger=""
        aria-expanded={open}
        aria-keyshortcuts={keys.aria}
        title={`Ask AI (${keys.label})`}
        disabled={locked}
        onClick={(event) => {
          const view = viewRef.current;
          if (!view) return;
          if (open) ai.closeMenu(true);
          else ai.openMenu(view, event.currentTarget);
        }}
        className={cn(editorTool, "w-auto gap-1 px-2 text-sm font-medium")}
      >
        <SparklesIcon aria-hidden="true" />
        AI
      </Toolbar.Button>
    </>
  );
}

function AiBubbleButton({ ai, state, viewRef, props, readOnly, locked }: AiRenderProps) {
  if (!isEnabled(props) || readOnly || locked || !aiSelectionRange(state).hasText) return null;
  const keys = shortcut();
  return (
    <Toolbar.Button
      aria-keyshortcuts={keys.aria}
      title={`Ask AI (${keys.label})`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        const view = viewRef.current;
        if (view) ai.openMenu(view, null);
      }}
      className={cn(editorTool, "w-auto gap-1.5 px-2 text-sm font-medium text-foreground")}
    >
      <SparklesIcon aria-hidden="true" />
      Ask AI
    </Toolbar.Button>
  );
}

function AiOverlay({ ai, state, viewRef, surfaceRef, props, readOnly, locked }: AiRenderProps) {
  const { menu, session } = useAi(ai);
  const active = isEnabled(props) && !readOnly && !locked;
  useEffect(() => {
    if (!active) ai.reset();
  }, [active, ai]);
  if (!active) return null;
  return (
    <>
      {menu && <AiMenuPanel ai={ai} menu={menu} actions={props.aiActions ?? DEFAULT_HTML_AI_ACTIONS} viewRef={viewRef} surfaceRef={surfaceRef} state={state} />}
      {session && <AiPreviewPanel ai={ai} session={session} review={Boolean(props.review)} viewRef={viewRef} surfaceRef={surfaceRef} state={state} />}
    </>
  );
}

/**
 * AI writing for HtmlEditorView, on when `onAiRequest` is set (off in
 * compact and read-only editors): an "AI" toolbar button, an "Ask AI"
 * selection toolbar button and Ctrl+J (Cmd+J on Apple) open a menu with a
 * prompt field and presets (`aiActions` replaces them). The result streams
 * into a preview below the target to replace, insert at the cursor, insert
 * below, suggest as a tracked change (with `review`), try again or discard.
 */
export function createAiExtension(setup: HtmlEditorExtensionSetup): HtmlEditorExtension {
  const ai = createAiController(setup);
  return {
    name: "ai",
    plugins: [htmlAiPlugin({ enabled: ai.enabled, open: (view) => ai.openMenu(view, null), escape: ai.escape, lost: ai.lost })],
    surfaceClassName: (props) => (isEnabled(props) ? SURFACE_CLASS : undefined),
    Toolbar: function AiToolbar(props: HtmlEditorRenderProps) {
      return <AiToolbarButton {...props} ai={ai} />;
    },
    Bubble: function AiBubble(props: HtmlEditorRenderProps) {
      return <AiBubbleButton {...props} ai={ai} />;
    },
    Overlay: function AiLayer(props: HtmlEditorRenderProps) {
      return <AiOverlay {...props} ai={ai} />;
    },
  };
}
