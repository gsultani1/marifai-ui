// packages/ai-ui/src/components/prompt-input-mentions.tsx
"use client";

import { LoaderCircleIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { usePromptInput } from "./prompt-input.js";

export interface MentionItem {
  id: string;
  label: string;
  description?: string;
  /** Items with the same group are listed under that heading. */
  group?: string;
  icon?: ReactNode;
  /** Replaces the trigger and query; defaults to the trigger, the label and a space. */
  insertText?: string;
}

export type MentionSource = (query: string) => MentionItem[] | Promise<MentionItem[]>;

export interface PromptInputMentionsProps {
  /** One source per trigger character, such as "@" for files and people and "/" for commands. */
  sources: Partial<Record<string, MentionSource>>;
  onSelect?: (item: MentionItem, trigger: string) => void;
  maxItems?: number;
  emptyText?: string;
}

interface Match {
  trigger: string;
  query: string;
  start: number;
  end: number;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds a trigger character at the start of a word ending at the caret. */
export function findMention(text: string, caret: number, triggers: string[]): Match | null {
  if (triggers.length === 0) return null;
  const before = text.slice(0, caret);
  const pattern = new RegExp(`(^|\\s)([${triggers.map(escapeRegExp).join("")}])([^\\s${triggers.map(escapeRegExp).join("")}]*)$`);
  const match = pattern.exec(before);
  if (!match) return null;
  const start = before.length - match[2]!.length - match[3]!.length;
  return { trigger: match[2]!, query: match[3]!, start, end: caret };
}

/**
 * Mention and command picker for PromptInput: typing "@" or "/" (or any
 * trigger you give a source for) at the start of a word opens a grouped
 * list filtered by what follows. Focus stays in the textarea; arrows move
 * (wrapping), Home and End jump, Enter or Tab inserts, Escape closes.
 * Sources may be async; stale results are dropped.
 */
export function PromptInputMentions({ sources, onSelect, maxItems = 50, emptyText = "No matches" }: PromptInputMentionsProps) {
  const { value, setValue, textareaRef } = usePromptInput();
  const [match, setMatch] = useState<Match | null>(null);
  const [items, setItems] = useState<MentionItem[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const container = usePortalContainer();
  const id = useId();
  const request = useRef(0);
  const state = useRef({ match, items, active, value });
  const sourcesRef = useRef(sources);
  const triggers = Object.keys(sources).filter((key) => sources[key]);
  const triggerKey = triggers.join("");

  useEffect(() => {
    state.current = { match, items, active, value };
    sourcesRef.current = sources;
  });

  const close = useCallback(() => {
    request.current++;
    setMatch(null);
    setItems([]);
    setLoading(false);
  }, []);

  const accept = (item: MentionItem) => {
    const current = state.current.match;
    const textarea = textareaRef.current;
    if (!current || !textarea) return;
    const insert = item.insertText ?? `${current.trigger}${item.label} `;
    const text = state.current.value;
    setValue(text.slice(0, current.start) + insert + text.slice(current.end));
    const caret = current.start + insert.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
    onSelect?.(item, current.trigger);
    close();
  };
  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const list = triggerKey.split("");

    const detect = () => {
      const caret = textarea.selectionStart ?? 0;
      if (textarea.selectionEnd !== caret) return close();
      const next = findMention(textarea.value, caret, list);
      if (!next) return close();
      const previous = state.current.match;
      setMatch(next);
      if (!previous) {
        const rect = textarea.getBoundingClientRect();
        setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top + 6, width: rect.width });
      }
      if (previous && previous.trigger === next.trigger && previous.query === next.query) return;
      setActive(0);
      const ticket = ++request.current;
      const result = sourcesRef.current[next.trigger]?.(next.query) ?? [];
      if (Array.isArray(result)) {
        setItems(result.slice(0, maxItems));
        setLoading(false);
        return;
      }
      setLoading(true);
      result.then(
        (found) => {
          if (ticket !== request.current) return;
          setItems(found.slice(0, maxItems));
          setLoading(false);
        },
        () => {
          if (ticket !== request.current) return;
          setItems([]);
          setLoading(false);
        },
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const { match: open, items: list, active: index } = state.current;
      if (!open || event.isComposing) return;
      const count = list.length;
      const move = (next: number) => {
        event.preventDefault();
        setActive(next);
      };
      if (event.key === "ArrowDown" && count) move((index + 1) % count);
      else if (event.key === "ArrowUp" && count) move((index - 1 + count) % count);
      else if (event.key === "Home" && count) move(0);
      else if (event.key === "End" && count) move(count - 1);
      else if ((event.key === "Enter" || event.key === "Tab") && count && !event.shiftKey) {
        event.preventDefault();
        acceptRef.current(list[index]!);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Tab", "Escape"].includes(event.key) || !state.current.match) detect();
    };

    textarea.addEventListener("input", detect);
    textarea.addEventListener("click", detect);
    textarea.addEventListener("keyup", onKeyUp);
    textarea.addEventListener("keydown", onKeyDown);
    textarea.addEventListener("blur", close);
    return () => {
      textarea.removeEventListener("input", detect);
      textarea.removeEventListener("click", detect);
      textarea.removeEventListener("keyup", onKeyUp);
      textarea.removeEventListener("keydown", onKeyDown);
      textarea.removeEventListener("blur", close);
    };
  }, [textareaRef, triggerKey, maxItems, close]);

  const open = match !== null;
  const activeId = open && items[active] ? `${id}-option-${active}` : undefined;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.setAttribute("aria-autocomplete", "list");
    if (open) textarea.setAttribute("aria-controls", `${id}-list`);
    else textarea.removeAttribute("aria-controls");
    if (activeId) textarea.setAttribute("aria-activedescendant", activeId);
    else textarea.removeAttribute("aria-activedescendant");
  }, [open, activeId, id, textareaRef]);

  if (!open || !anchor || typeof document === "undefined") return null;

  const groups: Array<{ name: string | undefined; entries: Array<{ item: MentionItem; index: number }> }> = [];
  items.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.entries.push({ item, index });
    else groups.push({ name: item.group, entries: [{ item, index }] });
  });

  const option = ({ item, index }: { item: MentionItem; index: number }) => (
    <li
      key={item.id}
      id={`${id}-option-${index}`}
      role="option"
      aria-selected={index === active}
      onPointerDown={(event) => event.preventDefault()}
      onPointerMove={() => index !== active && setActive(index)}
      onClick={() => accept(item)}
      className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
    >
      {item.icon && <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{item.icon}</span>}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.description && <span className="max-w-[50%] shrink-0 truncate text-xs text-muted-foreground">{item.description}</span>}
    </li>
  );

  return createPortal(
    <div className={cn(popupSurface, "fixed z-50 max-h-72 overflow-y-auto p-1")} style={{ left: anchor.left, bottom: anchor.bottom, width: Math.min(anchor.width, 420) }}>
      <ul id={`${id}-list`} role="listbox" aria-label={match.trigger === "/" ? "Commands" : "Mentions"}>
        {groups.map((group, index) =>
          group.name ? (
            <li key={`${group.name}-${index}`} role="presentation">
              <div aria-hidden="true" className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.name}
              </div>
              <ul role="group" aria-label={group.name}>
                {group.entries.map(option)}
              </ul>
            </li>
          ) : (
            group.entries.map(option)
          ),
        )}
      </ul>
      {!loading && items.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</p>}
      {loading && (
        <p className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
          <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          Searching
        </p>
      )}
      <span role="status" className="sr-only">
        {loading ? "Searching" : `${items.length} ${items.length === 1 ? "result" : "results"}`}
      </span>
    </div>,
    container ?? document.body,
  );
}
