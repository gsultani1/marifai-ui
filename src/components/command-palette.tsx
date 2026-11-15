// packages/ai-ui/src/components/command-palette.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { Fragment, type KeyboardEvent, type ReactNode, useEffect, useId, useState } from "react";

import { readDraft, useStoredDraft, writeDraft } from "../hooks/use-draft-store.js";
import { useControllableState } from "../hooks/use-controllable-state.js";
import { useApplePlatform, useShortcuts } from "../hooks/use-shortcuts.js";
import { modalBackdrop } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { fuzzyFilter, highlightRanges } from "../lib/fuzzy.js";
import { usePortalContainer } from "../lib/portal.js";
import { formatShortcut } from "../lib/shortcuts.js";

export interface Command {
  id: string;
  label: string;
  group?: string;
  description?: string;
  /** Extra words that should find the command. */
  keywords?: string[];
  icon?: ReactNode;
  /** Shown on the right, e.g. "mod+s". */
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface CommandMode {
  /** Typed first to switch mode, e.g. ">" for commands, "@" for symbols or ":" for go to line. */
  prefix: string;
  label: string;
  /** Static list filtered by the rest of the query, or a function (possibly async) that answers it. */
  commands: Command[] | ((query: string) => Command[] | Promise<Command[]>);
}

export interface CommandPaletteProps {
  commands: Command[];
  modes?: CommandMode[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Opens the palette from anywhere; false disables it. */
  hotkey?: string | false;
  placeholder?: string;
  /** localStorage key for recently used commands; false turns recents off. */
  recentKey?: string | false;
  label?: string;
  emptyMessage?: string;
}

const RECENT_LIMIT = 5;

function parseRecent(raw: string | null): string[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

interface Row {
  command: Command;
  group: string;
  indices: number[];
}

/**
 * Quick-open palette: fuzzy search with highlighted matches, groups,
 * recently used commands first, prefix modes such as ">" or ":" (static or
 * async), shortcuts shown per platform and the result count announced.
 */
export function CommandPalette({ commands, modes = [], open: openProp, defaultOpen = false, onOpenChange, hotkey = "mod+k", placeholder = "Search or type a command", recentKey = "ai-ui-command-recent", label = "Command palette", emptyMessage = "No matching commands." }: CommandPaletteProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [asyncResult, setAsyncResult] = useState<{ query: string; commands: Command[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const storedRecent = useStoredDraft(recentKey || undefined);
  const container = usePortalContainer();
  const apple = useApplePlatform();
  const id = useId();

  useShortcuts([
    {
      id: "command-palette",
      keys: hotkey || "mod+k",
      description: `Open ${label.toLowerCase()}`,
      group: "General",
      allowInInputs: true,
      enabled: hotkey !== false,
      handler: (event) => {
        event.preventDefault();
        setOpen(!open);
      },
    },
  ]);

  const mode = modes.find((candidate) => query.startsWith(candidate.prefix));
  const text = mode ? query.slice(mode.prefix.length).trimStart() : query;
  const source = mode?.commands;

  useEffect(() => {
    if (typeof source !== "function") return;
    let cancelled = false;
    void Promise.resolve(source(text))
      .then((result) => {
        if (!cancelled) setAsyncResult({ query, commands: result });
      })
      .catch(() => {
        if (!cancelled) setAsyncResult({ query, commands: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, text, query]);

  const recentIds = recentKey ? parseRecent(storedRecent) : [];
  let rows: Row[];
  if (typeof source === "function") {
    rows = (asyncResult?.query === query ? asyncResult.commands : []).map((command) => ({ command, group: command.group ?? mode!.label, indices: [] }));
  } else if (!text.trim() && !mode) {
    const recent = recentIds.flatMap((recentId) => commands.filter((command) => command.id === recentId && !command.disabled)).slice(0, RECENT_LIMIT);
    rows = [...recent.map((command) => ({ command, group: "Recent", indices: [] })), ...commands.filter((command) => !recent.includes(command)).map((command) => ({ command, group: command.group ?? "Commands", indices: [] }))];
  } else {
    rows = fuzzyFilter(source ?? commands, text, (command) => [command.label, ...(command.keywords ?? []), command.group ?? "", command.description ?? ""]).map(({ item, match, field }) => ({ command: item, group: item.group ?? mode?.label ?? "Commands", indices: field === 0 ? match.indices : [] }));
  }
  const groups: Array<{ name: string; rows: Array<Row & { index: number }> }> = [];
  for (const [index, row] of rows.entries()) {
    const group = groups.find((item) => item.name === row.group);
    if (group) group.rows.push({ ...row, index });
    else groups.push({ name: row.group, rows: [{ ...row, index }] });
  }
  const ordered = groups.flatMap((group) => group.rows);
  const activeRow = ordered[Math.min(active, ordered.length - 1)];

  const activeIndex = activeRow?.index;
  useEffect(() => {
    if (activeIndex === undefined) return;
    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id]);

  const run = (command: Command) => {
    if (command.disabled) return;
    if (recentKey) writeDraft(recentKey, JSON.stringify([command.id, ...parseRecent(readDraft(recentKey)).filter((item) => item !== command.id)].slice(0, 20)));
    setOpen(false);
    setQuery("");
    command.onSelect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!ordered.length) return;
    const position = activeRow ? ordered.indexOf(activeRow) : 0;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((position + (event.key === "ArrowDown" ? 1 : -1) + ordered.length) % ordered.length);
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      setActive(event.key === "PageDown" ? ordered.length - 1 : 0);
    } else if (event.key === "Enter" && activeRow && !event.nativeEvent.isComposing) {
      event.preventDefault();
      run(activeRow.command);
    }
  };

  const hint = !query && modes.length > 0 ? modes.map((item) => `${item.prefix} ${item.label.toLowerCase()}`).join(" · ") : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={modalBackdrop} />
        <Dialog.Popup className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            {loading ? <LoaderCircleIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" /> : <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            {mode && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{mode.label}</span>}
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={activeRow ? `${id}-option-${activeRow.index}` : undefined}
              aria-label={label}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                setActive(0);
                const nextMode = modes.find((candidate) => next.startsWith(candidate.prefix));
                if (typeof nextMode?.commands === "function") setLoading(true);
              }}
              onKeyDown={onKeyDown}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {hint && <p className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">Type {hint}</p>}
          <div id={`${id}-list`} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {groups.map((group, groupIndex) => (
              <div key={group.name} role="group" aria-labelledby={`${id}-group-${groupIndex}`}>
                <div id={`${id}-group-${groupIndex}`} role="presentation" className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                  {group.name}
                </div>
                {group.rows.map((row) => {
                  const selected = row === activeRow;
                  return (
                    <div
                      key={`${group.name}-${row.command.id}`}
                      id={`${id}-option-${row.index}`}
                      role="option"
                      aria-label={row.command.description ? `${row.command.label}, ${row.command.description}` : row.command.label}
                      aria-selected={selected}
                      aria-disabled={row.command.disabled || undefined}
                      onPointerMove={() => setActive(ordered.indexOf(row))}
                      onClick={() => run(row.command)}
                      className={cn("flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground", selected && "bg-accent text-accent-foreground", row.command.disabled && "cursor-not-allowed opacity-60")}
                    >
                      {row.command.icon}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">
                          {highlightRanges(row.command.label, row.indices).map((part, index) => (
                            <Fragment key={index}>{part.match ? <mark className="bg-transparent font-semibold text-foreground underline decoration-ring decoration-2 underline-offset-2">{part.text}</mark> : part.text}</Fragment>
                          ))}
                        </span>
                        {row.command.description && <span className="truncate text-xs text-muted-foreground">{row.command.description}</span>}
                      </span>
                      {row.command.shortcut && (
                        <kbd aria-hidden="true" className="shrink-0 rounded border border-border px-1.5 font-sans text-[0.6875rem] text-muted-foreground">
                          {formatShortcut(row.command.shortcut, apple)}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {!ordered.length && !loading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
          </div>
          <p role="status" className="sr-only">
            {loading ? "" : `${ordered.length} ${ordered.length === 1 ? "result" : "results"}`}
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
