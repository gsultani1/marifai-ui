// packages/ai-ui/src/components/emoji-picker.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { SmilePlusIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

import { readDraft, useStoredDraft, writeDraft } from "../hooks/use-draft-store.js";
import { focusRing, iconButton, input, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type Emoji, emojiCategories, findEmoji, searchEmoji, SKIN_TONES, type SkinTone, stripSkinTone, withSkinTone } from "../lib/emoji.js";
import { usePortalContainer } from "../lib/portal.js";

const RECENT_LIMIT = 24;

function parseRecent(raw: string | null): Emoji[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.flatMap((char) => (typeof char === "string" ? (findEmoji(char) ?? []) : [])) : [];
  } catch {
    return [];
  }
}

export interface EmojiPickerPanelProps {
  /** Receives the emoji with the chosen skin tone applied. */
  onSelect: (emoji: string) => void;
  /** localStorage prefix for recent emoji and skin tone; false keeps them in memory only. */
  storageKey?: string | false;
  label?: string;
  autoFocus?: boolean;
  className?: string;
}

interface Section {
  id: string;
  name: string;
  icon: string;
  emoji: Emoji[];
}

/**
 * Searchable emoji grid with category tabs, recently used emoji and a skin
 * tone choice. Arrow keys move through the grid; Enter in the search field
 * picks the first match.
 */
export function EmojiPickerPanel({ onSelect, storageKey = "ai-ui-emoji", label = "Emoji", autoFocus = false, className }: EmojiPickerPanelProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [memoryRecent, setMemoryRecent] = useState<string[]>([]);
  const [memoryTone, setMemoryTone] = useState<SkinTone>(0);
  const storedRecent = useStoredDraft(storageKey ? `${storageKey}:recent` : undefined);
  const storedTone = useStoredDraft(storageKey ? `${storageKey}:tone` : undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const tone = (storageKey ? Math.min(5, Math.max(0, Number(storedTone) || 0)) : memoryTone) as SkinTone;
  const recent = storageKey ? parseRecent(storedRecent) : parseRecent(JSON.stringify(memoryRecent));
  const results = query.trim() ? searchEmoji(query) : null;
  const sections: Section[] = results
    ? [{ id: "results", name: results.length ? "Search results" : "No emoji found", icon: "", emoji: results }]
    : [...(recent.length ? [{ id: "recent", name: "Recently used", icon: "🕘", emoji: recent }] : []), ...emojiCategories()];
  const flat = sections.flatMap((section) => section.emoji);
  const offsets = sections.map((_, index) => sections.slice(0, index).reduce((total, section) => total + section.emoji.length, 0));
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));

  const setTone = (next: SkinTone) => {
    if (storageKey) writeDraft(`${storageKey}:tone`, next ? String(next) : "");
    else setMemoryTone(next);
  };

  const choose = (emoji: Emoji) => {
    const base = stripSkinTone(emoji.char);
    if (storageKey) {
      const key = `${storageKey}:recent`;
      const list = parseRecent(readDraft(key)).map((item) => item.char);
      writeDraft(key, JSON.stringify([base, ...list.filter((char) => char !== base)].slice(0, RECENT_LIMIT)));
    } else setMemoryRecent([base, ...memoryRecent.filter((char) => char !== base)].slice(0, RECENT_LIMIT));
    onSelect(withSkinTone(emoji, tone));
  };

  const focusIndex = (index: number) => {
    const buttons = scrollRef.current?.querySelectorAll<HTMLButtonElement>("[data-emoji]");
    const target = buttons?.[index];
    if (!target) return;
    setActive(index);
    target.focus();
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(scrollRef.current?.querySelectorAll<HTMLButtonElement>("[data-emoji]") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    let next: number | undefined;
    if (event.key === "ArrowRight") next = index + 1;
    else if (event.key === "ArrowLeft") next = index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const down = event.key === "ArrowDown";
      const current = buttons[index]!.getBoundingClientRect();
      const row = buttons.map((button, position) => ({ position, rect: button.getBoundingClientRect() })).filter(({ rect }) => (down ? rect.top > current.top + 1 : rect.top < current.top - 1));
      if (row.length) {
        const edge = down ? Math.min(...row.map(({ rect }) => rect.top)) : Math.max(...row.map(({ rect }) => rect.top));
        const candidates = row.filter(({ rect }) => Math.abs(rect.top - edge) < 1);
        next = candidates.reduce((best, item) => (Math.abs(item.rect.left - current.left) < Math.abs(best.rect.left - current.left) ? item : best)).position;
      } else if (!down) {
        event.preventDefault();
        document.getElementById(`${id}-search`)?.focus();
        return;
      }
    }
    if (next === undefined || next < 0 || next >= buttons.length) return;
    event.preventDefault();
    focusIndex(next);
  };

  return (
    <div data-slot="emoji-picker" className={cn("flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2", className)}>
      <label htmlFor={`${id}-search`} className="sr-only">
        Search emoji
      </label>
      <input
        id={`${id}-search`}
        type="search"
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="Search emoji"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          scrollRef.current?.scrollTo({ top: 0 });
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && flat.length) {
            event.preventDefault();
            focusIndex(activeIndex);
          } else if (event.key === "Enter" && results?.[0]) {
            event.preventDefault();
            choose(results[0]);
          }
        }}
        className={cn(input, focusRing, "focus-visible:ring-offset-0")}
      />
      {!results && (
        <nav aria-label="Emoji categories" className="flex justify-between gap-0.5">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-label={section.name}
              title={section.name}
              onClick={() => {
                const container = scrollRef.current;
                const target = document.getElementById(`${id}-section-${section.id}`);
                if (container && target) container.scrollTo({ top: target.offsetTop - container.offsetTop });
              }}
              className={cn(iconButton, "size-7 text-base", focusRing)}
            >
              <span aria-hidden="true">{section.icon}</span>
            </button>
          ))}
        </nav>
      )}
      <div ref={scrollRef} role="group" aria-label={label} onKeyDown={onGridKeyDown} className="relative h-64 overflow-y-auto overscroll-contain">
        {sections.map((section, sectionIndex) => {
          const offset = offsets[sectionIndex]!;
          return (
            <section key={section.id} id={`${id}-section-${section.id}`} aria-labelledby={`${id}-heading-${section.id}`} className="pb-2">
              <h4 id={`${id}-heading-${section.id}`} className="sticky top-0 z-10 bg-popover py-1 text-xs font-medium text-muted-foreground">
                {section.name}
              </h4>
              <div className="grid grid-cols-8 gap-0.5">
                {section.emoji.map((emoji, index) => {
                  const position = offset + index;
                  return (
                    <button
                      key={`${section.id}-${emoji.char}`}
                      type="button"
                      data-emoji={emoji.char}
                      aria-label={emoji.name}
                      title={emoji.name}
                      tabIndex={position === activeIndex ? 0 : -1}
                      onFocus={() => setActive(position)}
                      onClick={() => choose(emoji)}
                      className={cn("flex aspect-square items-center justify-center rounded-md text-xl leading-none hover:bg-accent", focusRing, "focus-visible:ring-offset-0")}
                    >
                      <span aria-hidden="true">{withSkinTone(emoji, tone)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <fieldset className="flex items-center gap-1 border-t border-border pt-2">
        <legend className="sr-only">Skin tone</legend>
        <span aria-hidden="true" className="mr-auto text-xs text-muted-foreground">
          Skin tone
        </span>
        {SKIN_TONES.map((option) => (
          <label key={option.tone} title={option.name} className="relative cursor-pointer">
            <input type="radio" name={`${id}-tone`} checked={tone === option.tone} onChange={() => setTone(option.tone)} className="peer sr-only" />
            <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md text-base peer-checked:bg-accent peer-checked:ring-1 peer-checked:ring-border peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {withSkinTone({ char: "✋", name: "", keywords: "", tone: true }, option.tone)}
            </span>
            <span className="sr-only">{option.name}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export interface EmojiPickerProps extends Omit<EmojiPickerPanelProps, "autoFocus"> {
  /** Accessible name of the trigger. */
  triggerLabel?: string;
  /** Trigger content; defaults to a smiley icon. */
  children?: ReactNode;
  /** Keeps the picker open after a choice, for adding several. */
  keepOpen?: boolean;
  triggerClassName?: string;
  disabled?: boolean;
}

/** Emoji picker in a popover, opened from an icon button. */
export function EmojiPicker({ triggerLabel = "Add emoji", children, keepOpen = false, triggerClassName, disabled, onSelect, ...panel }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const container = usePortalContainer();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger disabled={disabled} aria-label={triggerLabel} title={triggerLabel} className={cn(iconButton, focusRing, triggerClassName)}>
        {children ?? <SmilePlusIcon aria-hidden="true" />}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={6} align="start" collisionPadding={8} className="z-50">
          <Popover.Popup aria-label={panel.label ?? "Emoji"} className={cn(popupSurface, "p-2 outline-none")}>
            <EmojiPickerPanel
              {...panel}
              autoFocus
              onSelect={(emoji) => {
                onSelect(emoji);
                if (!keepOpen) setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
