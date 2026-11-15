// packages/ai-ui/src/components/file-search.tsx
"use client";

import { CaseSensitiveIcon, ChevronRightIcon, RegexIcon, WholeWordIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type FileSearchOptions, type FileSearchResult, type SearchableFile, searchFileContents } from "../lib/file-search.js";
import { baseName, parentPath } from "../lib/file-tree.js";
import { fileIcon } from "./file-tree.js";
import { SearchInput } from "./search-input.js";

export interface FileSearchProps {
  /** Searched in the browser when `onSearch` isn't given. */
  files?: SearchableFile[];
  /** Server-side search; the signal aborts when a newer search starts. */
  onSearch?: (query: string, options: FileSearchOptions, signal: AbortSignal) => Promise<FileSearchResult>;
  /** Opens a result at its line and column (1-based). */
  onOpen: (path: string, line: number, column: number) => void;
  maxResults?: number;
  defaultQuery?: string;
  className?: string;
}

function Preview({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="rounded-sm bg-warning/30 text-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * Find in files: debounced search with match case, whole word and regular
 * expression toggles, results grouped by file with highlighted matches,
 * a cap with a notice, and Enter to open at the line.
 */
export function FileSearch({ files = [], onSearch, onOpen, maxResults = 500, defaultQuery = "", className }: FileSearchProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [submitted, setSubmitted] = useState(defaultQuery);
  const [options, setOptions] = useState<Required<Pick<FileSearchOptions, "matchCase" | "wholeWord" | "regex">>>({ matchCase: false, wholeWord: false, regex: false });
  const [remote, setRemote] = useState<{ key: string; result: FileSearchResult } | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([submitted, options]);
  const result: FileSearchResult | null = !submitted ? null : onSearch ? (remote?.key === key ? remote.result : null) : searchFileContents(files, submitted, { ...options, maxResults });

  useEffect(() => {
    if (!onSearch || !submitted) return;
    const controller = new AbortController();
    const [text, opts] = JSON.parse(key) as [string, FileSearchOptions];
    onSearch(text, { ...opts, maxResults }, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setRemote({ key, result: next });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setRemote({ key, result: { groups: [], total: 0, truncated: false, skippedFiles: 0, error: error instanceof Error ? error.message : "Search failed." } });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [key, onSearch, submitted, maxResults]);

  const toggleOption = (name: keyof typeof options) => {
    setOptions({ ...options, [name]: !options[name] });
    if (onSearch && submitted) setLoading(true);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-result]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (next < 0 || next >= items.length) return;
    event.preventDefault();
    setActive(next);
    items[next]!.focus();
  };

  const fileCount = result?.groups.length ?? 0;
  const offsets = (result?.groups ?? []).map((_, index, groups) => groups.slice(0, index).reduce((total, group) => total + (collapsed.has(group.path) ? 0 : group.matches.length), 0));

  return (
    <div data-slot="file-search" className={cn("flex min-h-0 flex-col gap-2 text-sm", className)}>
      <div className="flex items-center gap-1">
        <SearchInput
          label="Search in files"
          placeholder="Search in files"
          value={query}
          onValueChange={setQuery}
          loading={loading}
          debounceMs={250}
          onSearch={(next) => {
            setSubmitted(next);
            setActive(0);
            if (onSearch && next) setLoading(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              listRef.current?.querySelector<HTMLButtonElement>("[data-result]")?.focus();
            }
          }}
          {...(result ? { resultCount: result.total } : {})}
          className="flex-1"
        />
        {(
          [
            ["matchCase", "Match case", <CaseSensitiveIcon key="case" aria-hidden="true" />],
            ["wholeWord", "Match whole word", <WholeWordIcon key="word" aria-hidden="true" />],
            ["regex", "Use regular expression", <RegexIcon key="regex" aria-hidden="true" />],
          ] as const
        ).map(([name, title, icon]) => (
          <button key={name} type="button" aria-pressed={options[name]} aria-label={title} title={title} onClick={() => toggleOption(name)} className={cn(iconButton, "aria-pressed:bg-accent aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-border", focusRing)}>
            {icon}
          </button>
        ))}
      </div>
      {result?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {result.error}
        </p>
      ) : (
        result && (
          <p className="text-xs text-muted-foreground">
            {result.total === 0 ? "No results." : `${result.truncated ? "First " : ""}${result.total.toLocaleString()} ${result.total === 1 ? "result" : "results"} in ${fileCount} ${fileCount === 1 ? "file" : "files"}`}
            {result.truncated && ". Refine the search to see everything."}
            {result.skippedFiles > 0 && ` ${result.skippedFiles} large ${result.skippedFiles === 1 ? "file was" : "files were"} skipped.`}
          </p>
        )
      )}
      <div ref={listRef} onKeyDown={onListKeyDown} className="min-h-0 flex-1 overflow-y-auto">
        {result?.groups.map((group, groupIndex) => {
          const open = !collapsed.has(group.path);
          const folder = parentPath(group.path);
          return (
            <section key={group.path} aria-label={group.path}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  const next = new Set(collapsed);
                  if (open) next.add(group.path);
                  else next.delete(group.path);
                  setCollapsed(next);
                }}
                className={cn("flex w-full items-center gap-1.5 rounded-sm px-1 py-1 text-left hover:bg-accent/60 [&_svg]:size-4 [&_svg]:shrink-0", focusRing, "focus-visible:ring-offset-0")}
              >
                <ChevronRightIcon aria-hidden="true" className={cn("text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-90")} />
                <span className="text-muted-foreground">{fileIcon(group.path)}</span>
                <span className="truncate font-medium">{baseName(group.path)}</span>
                {folder && <span className="truncate text-xs text-muted-foreground">{folder}</span>}
                <span className="ml-auto rounded-full bg-muted px-1.5 text-xs tabular-nums">{group.matches.length}</span>
              </button>
              {open && (
                <ul>
                  {group.matches.map((match, matchIndex) => {
                    const index = offsets[groupIndex]! + matchIndex;
                    return (
                      <li key={`${match.line}:${match.column}`}>
                        <button
                          type="button"
                          data-result
                          tabIndex={index === active ? 0 : -1}
                          onFocus={() => setActive(index)}
                          onClick={() => onOpen(group.path, match.line, match.column)}
                          aria-label={`Line ${match.line}: ${match.preview.trim()}`}
                          className={cn("flex w-full items-baseline gap-2 rounded-sm py-0.5 pr-1 pl-7 text-left font-mono text-xs hover:bg-accent/60", focusRing, "focus-visible:ring-offset-0")}
                        >
                          <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">{match.line}</span>
                          <span className="min-w-0 truncate whitespace-pre">
                            <Preview text={match.preview} ranges={match.ranges} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
