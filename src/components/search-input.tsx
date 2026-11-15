// packages/ai-ui/src/components/search-input.tsx
"use client";

import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatShortcut, isEditableTarget, matchesStep, parseShortcut } from "../lib/shortcuts.js";

export interface SearchInputProps extends Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "size"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Runs once typing pauses for `debounceMs`, and at once on Enter or clear. */
  onSearch?: (query: string) => void;
  debounceMs?: number;
  loading?: boolean;
  /** Focuses the field from anywhere on the page, such as "/" or "mod+k"; ignored while typing in another field. */
  shortcut?: string;
  /** Announced to screen readers after each search. */
  resultCount?: number;
  label?: string;
}

/**
 * Search field with a debounced `onSearch`, a clear button, Escape to clear
 * (or leave when empty), a loading spinner, an optional page-wide shortcut
 * and a polite result count for screen readers.
 */
export function SearchInput({ value, defaultValue = "", onValueChange, onSearch, debounceMs = 250, loading = false, shortcut, resultCount, label = "Search", placeholder = "Search", className, onKeyDown, ...props }: SearchInputProps) {
  const [query, setQuery] = useControllableState<string>({ value, defaultValue, onChange: onValueChange });
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!shortcut) return;
    const [step] = parseShortcut(shortcut);
    if (!step) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target) || !matchesStep(event, step)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const search = (next: string, immediate: boolean) => {
    clearTimeout(timer.current);
    if (!onSearch) return;
    if (immediate) onSearch(next);
    else timer.current = setTimeout(() => onSearch(next), debounceMs);
  };

  const clear = () => {
    setQuery("");
    search("", true);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative flex min-w-0 items-center", className)}>
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
      <input
        {...props}
        ref={inputRef}
        type="search"
        aria-label={props["aria-labelledby"] ? undefined : label}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          search(event.target.value, false);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Enter") search(query, true);
          else if (event.key === "Escape") {
            if (query) {
              event.preventDefault();
              clear();
            } else event.currentTarget.blur();
          }
        }}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        className={cn(input, focusRing, "pr-9 pl-8 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:appearance-none")}
      />
      <span className="absolute right-1 flex items-center">
        {loading ? (
          <LoaderCircleIcon aria-hidden="true" className="mr-1.5 size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
        ) : query ? (
          <button type="button" aria-label="Clear search" onClick={clear} className={cn(iconButton, "size-7", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        ) : (
          shortcut &&
          !focused && (
            <kbd aria-hidden="true" className="mr-1 rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">
              {formatShortcut(shortcut)}
            </kbd>
          )
        )}
      </span>
      <span role="status" className="sr-only">
        {loading ? "Searching" : resultCount === undefined || !query ? "" : `${resultCount} ${resultCount === 1 ? "result" : "results"}`}
      </span>
    </div>
  );
}
