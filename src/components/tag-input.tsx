// packages/ai-ui/src/components/tag-input.tsx
"use client";

import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, XIcon } from "lucide-react";
import { type ClipboardEvent, type KeyboardEvent, useId, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export interface TagInputProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (tags: string[]) => void;
  /** Offered in a filtered list while typing; typed text is accepted too. */
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  /** Returns a message to reject a tag. */
  validate?: (tag: string, tags: string[]) => string | null | undefined;
  /** Applied before validation, such as lower-casing. */
  transform?: (tag: string) => string;
  allowDuplicates?: boolean;
  /** Characters that end a tag while typing or pasting, in addition to Enter. */
  separators?: string[];
  /** Commits typed text when focus leaves the field. */
  addOnBlur?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Chips with a text field: Enter, comma or Tab adds the typed text, pasting
 * a list adds every item, Backspace in an empty field removes the last tag,
 * Left Arrow from the start reaches the chips, and suggestions filter as you type. Duplicates (case-insensitive), the tag
 * limit and `validate` reject entries with a message instead of failing silently.
 */
export function TagInput({
  value,
  defaultValue = [],
  onValueChange,
  suggestions = [],
  placeholder = "Add a tag",
  maxTags,
  validate,
  transform,
  allowDuplicates = false,
  separators = [","],
  addOnBlur = true,
  disabled = false,
  readOnly = false,
  name,
  id,
  "aria-label": ariaLabel,
  className,
}: TagInputProps) {
  const [tags, setTags] = useControllableState<string[]>({ value, defaultValue, onChange: onValueChange });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const highlighted = useRef<string | undefined>(undefined);
  const container = usePortalContainer();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const full = maxTags !== undefined && tags.length >= maxTags;
  const splitter = new RegExp(`[${separators.map(escapeRegExp).join("")}\\n\\t]+`);

  const add = (raw: string[]) => {
    const next = [...tags];
    const problems: string[] = [];
    for (const entry of raw) {
      const tag = (transform ? transform(entry.trim()) : entry.trim()).trim();
      if (!tag) continue;
      if (maxTags !== undefined && next.length >= maxTags) {
        problems.push(`You can add up to ${maxTags} tags.`);
        break;
      }
      if (!allowDuplicates && next.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
        problems.push(`"${tag}" is already added.`);
        continue;
      }
      const error = validate?.(tag, next);
      if (error) {
        problems.push(error);
        continue;
      }
      next.push(tag);
    }
    if (next.length !== tags.length) setTags(next);
    setMessage(problems.join(" "));
    return problems.length === 0;
  };

  const commitQuery = () => {
    if (!query.trim()) return false;
    if (add(query.split(splitter))) setQuery("");
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if ((event.key === "Enter" && !highlighted.current) || separators.includes(event.key)) {
      if (commitQuery() || separators.includes(event.key)) event.preventDefault();
    } else if (event.key === "Tab" && query.trim()) {
      commitQuery();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!splitter.test(text)) return;
    event.preventDefault();
    add(`${query}${text}`.split(splitter));
    setQuery("");
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Combobox.Root
        items={suggestions}
        multiple
        value={tags}
        onValueChange={(next: string[]) => {
          const added = next.filter((tag) => !tags.includes(tag));
          if (added.length === 0) {
            setTags(next);
            setMessage("");
          } else add(added);
          setQuery("");
        }}
        inputValue={query}
        onInputValueChange={(next) => {
          setQuery(next);
          if (message) setMessage("");
        }}
        onItemHighlighted={(item: string | undefined) => {
          highlighted.current = item;
        }}
        disabled={disabled}
        readOnly={readOnly}
        name={name}
      >
        <Combobox.InputGroup className={cn("flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1 text-sm focus-within:ring-2 focus-within:ring-ring data-[invalid]:border-destructive", disabled && "cursor-not-allowed opacity-50")}>
          <Combobox.Chips aria-label={tags.length ? "Tags" : undefined} className="flex w-full flex-wrap items-center gap-1">
            {tags.map((tag) => (
              <Combobox.Chip key={tag} aria-label={tag} className="flex h-6 items-center gap-1 rounded-md bg-muted pr-0.5 pl-2 text-xs font-medium outline-none data-[highlighted]:ring-2 data-[highlighted]:ring-ring focus:ring-2 focus:ring-ring">
                {tag}
                {!readOnly && !disabled && (
                  <Combobox.ChipRemove aria-label={`Remove ${tag}`} className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground">
                    <XIcon aria-hidden="true" className="size-3" />
                  </Combobox.ChipRemove>
                )}
              </Combobox.Chip>
            ))}
            <Combobox.Input
              id={inputId}
              aria-label={ariaLabel}
              placeholder={tags.length ? "" : placeholder}
              aria-description={tags.length ? `${tags.length} added. From the start of the field, press Left Arrow to reach them.` : undefined}
              readOnly={readOnly || full}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onBlur={() => addOnBlur && commitQuery()}
              className="h-6 min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
            />
          </Combobox.Chips>
        </Combobox.InputGroup>
        {suggestions.length > 0 && (
          <Combobox.Portal container={container}>
            <Combobox.Positioner sideOffset={4} className="z-50">
              <Combobox.Popup className={cn(popupSurface, "max-h-[min(var(--available-height),18rem)] w-[var(--anchor-width)] overflow-y-auto p-1")}>
                <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">{query.trim() ? `Press Enter to add "${query.trim()}"` : "No suggestions"}</Combobox.Empty>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item} className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                      <Combobox.ItemIndicator className="flex size-4 items-center justify-center">
                        <CheckIcon aria-hidden="true" className="size-3.5" />
                      </Combobox.ItemIndicator>
                      <span className="min-w-0 flex-1 truncate">{item}</span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        )}
      </Combobox.Root>
      <div className="flex justify-between gap-2 text-xs">
        <p role="status" className="font-medium text-destructive">
          {message}
        </p>
        {maxTags !== undefined && (
          <span className={cn("shrink-0 tabular-nums", full ? "font-medium text-foreground" : "text-muted-foreground")}>
            {tags.length}/{maxTags}
          </span>
        )}
      </div>
    </div>
  );
}

