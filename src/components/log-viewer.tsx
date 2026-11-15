// packages/ai-ui/src/components/log-viewer.tsx
"use client";

import { ArrowDownToLineIcon, CheckIcon, ClockIcon, CopyIcon, DownloadIcon, PlugZapIcon, Trash2Icon, WrapTextIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { readDraft, writeDraft } from "../hooks/use-draft-store.js";
import { applyCarriageReturns, stripAnsi } from "../lib/ansi.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText } from "../lib/download.js";
import type { LogLevel, LogLine } from "../lib/log-buffer.js";
import { AnsiText } from "./ansi-text.js";
import { FilterChips } from "./filter-chips.js";
import { SearchInput } from "./search-input.js";

export type LogConnection = "connected" | "connecting" | "disconnected";

export interface LogViewerProps {
  lines: LogLine[];
  /** Lines dropped from the start by a cap, shown as a notice. */
  dropped?: number;
  connection?: LogConnection;
  onReconnect?: () => void;
  onClear?: () => void;
  /** Adds a command line under the output with Up and Down history. */
  onCommand?: (command: string) => void;
  /** localStorage key for command history. */
  historyKey?: string;
  prompt?: string;
  /** Rows rendered at most; earlier lines stay searchable and downloadable. */
  maxRendered?: number;
  label?: string;
  emptyMessage?: string;
  /** File name for "Download". */
  fileName?: string;
  className?: string;
}

const HISTORY_LIMIT = 100;

const LEVEL_STRIPE: Record<LogLevel, string> = {
  debug: "border-l-transparent",
  info: "border-l-transparent",
  warn: "border-l-warning",
  error: "border-l-destructive",
};

function readHistory(key: string | undefined): string[] {
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(readDraft(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Process output: ANSI colors, carriage-return redraws, stderr and level
 * markers, optional timestamps, search with highlights, error and warning
 * filters, follow mode with a jump to latest, wrap, copy, download, a
 * connection banner and a command line with history.
 */
export function LogViewer({
  lines,
  dropped = 0,
  connection = "connected",
  onReconnect,
  onClear,
  onCommand,
  historyKey,
  prompt = "$",
  maxRendered = 2000,
  label = "Output",
  emptyMessage = "No output yet.",
  fileName = "output.log",
  className,
}: LogViewerProps) {
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<string[]>([]);
  const [timestamps, setTimestamps] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [following, setFollowing] = useState(true);
  const [seen, setSeen] = useState(lines.length);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>(() => readHistory(historyKey));
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { copied, copy } = useCopyToClipboard();
  const id = useId();
  const needle = query.trim().toLowerCase();
  const filtered = lines.filter((line) => (!levels.length || (line.level && levels.includes(line.level)) || (levels.includes("error") && line.stream === "stderr" && !line.level)) && (!needle || stripAnsi(line.text).toLowerCase().includes(needle)));
  const rendered = filtered.slice(-maxRendered);
  const hiddenEarlier = filtered.length - rendered.length;
  const counts = { error: lines.filter((line) => line.level === "error").length, warn: lines.filter((line) => line.level === "warn").length };
  const unseen = following ? 0 : Math.max(0, lines.length - seen);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (following && seen !== lines.length) setSeen(lines.length);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && following) element.scrollTop = element.scrollHeight;
  }, [lines, following, rendered.length]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => setFollowing(element.scrollHeight - element.scrollTop - element.clientHeight < 24);
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  const plain = () => filtered.map((line) => `${timestamps && line.timestamp ? `[${new Date(line.timestamp).toISOString()}] ` : ""}${stripAnsi(applyCarriageReturns(line.text))}`).join("\n");

  const runCommand = () => {
    const text = command.trim();
    if (!text || !onCommand) return;
    onCommand(text);
    const next = [...history.filter((item) => item !== text), text].slice(-HISTORY_LIMIT);
    setHistory(next);
    if (historyKey) writeDraft(historyKey, JSON.stringify(next));
    setCommand("");
    setHistoryIndex(null);
    setFollowing(true);
  };

  const onCommandKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand();
    } else if (event.key === "ArrowUp" && history.length) {
      event.preventDefault();
      const index = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(index);
      setCommand(history[index]!);
    } else if (event.key === "ArrowDown" && historyIndex !== null) {
      event.preventDefault();
      const index = historyIndex + 1;
      if (index >= history.length) {
        setHistoryIndex(null);
        setCommand("");
      } else {
        setHistoryIndex(index);
        setCommand(history[index]!);
      }
    }
  };

  return (
    <section aria-label={label} data-slot="log-viewer" className={cn("relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-code-background text-code-foreground", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background px-2 py-1 text-foreground">
        <SearchInput label={`Search ${label.toLowerCase()}`} placeholder="Filter output" value={query} onValueChange={setQuery} resultCount={filtered.length} className="w-48 max-w-full [&_input]:h-7" />
        {(counts.error > 0 || counts.warn > 0) && (
          <FilterChips
            label="Show only"
            value={levels}
            onValueChange={setLevels}
            clearLabel={false}
            options={[
              ...(counts.error ? [{ value: "error", label: "Errors", count: counts.error }] : []),
              ...(counts.warn ? [{ value: "warn", label: "Warnings", count: counts.warn }] : []),
            ]}
          />
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" aria-pressed={timestamps} aria-label="Show timestamps" title="Show timestamps" onClick={() => setTimestamps(!timestamps)} className={cn(iconButton, "size-7 aria-pressed:bg-accent aria-pressed:text-foreground", focusRing)}>
            <ClockIcon aria-hidden="true" />
          </button>
          <button type="button" aria-pressed={wrap} aria-label="Wrap lines" title="Wrap lines" onClick={() => setWrap(!wrap)} className={cn(iconButton, "size-7 aria-pressed:bg-accent aria-pressed:text-foreground", focusRing)}>
            <WrapTextIcon aria-hidden="true" />
          </button>
          <button type="button" aria-label={copied ? "Copied" : "Copy output"} title="Copy output" disabled={!filtered.length} onClick={() => void copy(plain())} className={cn(iconButton, "size-7", focusRing)}>
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          </button>
          <button type="button" aria-label="Download output" title="Download output" disabled={!lines.length} onClick={() => downloadText(fileName, plain())} className={cn(iconButton, "size-7", focusRing)}>
            <DownloadIcon aria-hidden="true" />
          </button>
          {onClear && (
            <button type="button" aria-label="Clear output" title="Clear output" disabled={!lines.length} onClick={onClear} className={cn(iconButton, "size-7", focusRing)}>
              <Trash2Icon aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {connection !== "connected" && (
        <div role="status" className="flex items-center gap-2 border-b border-border bg-background px-3 py-1.5 text-xs text-foreground [&_svg]:size-3.5">
          <PlugZapIcon aria-hidden="true" className={connection === "disconnected" ? "text-destructive" : "text-muted-foreground"} />
          <span className="flex-1">{connection === "disconnected" ? "Disconnected. Output may be incomplete." : "Reconnecting…"}</span>
          {connection === "disconnected" && onReconnect && (
            <button type="button" onClick={onReconnect} className={cn("rounded px-1.5 py-0.5 font-medium underline underline-offset-2 hover:no-underline", focusRing)}>
              Reconnect
            </button>
          )}
        </div>
      )}
      <div ref={scrollRef} role="log" aria-live="off" aria-label={`${label} lines`} tabIndex={0} className={cn("min-h-0 flex-1 overflow-auto py-1 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", !wrap && "whitespace-pre")}>
        {(dropped > 0 || hiddenEarlier > 0) && (
          <p className="px-3 py-1 text-muted-foreground italic">
            {dropped > 0 ? `${dropped.toLocaleString()} earlier lines were dropped.` : ""} {hiddenEarlier > 0 ? `${hiddenEarlier.toLocaleString()} earlier lines are hidden; download to see everything.` : ""}
          </p>
        )}
        {rendered.map((line) => (
          <div key={line.id} data-stream={line.stream} data-level={line.level} className={cn("flex gap-3 border-l-2 px-3", line.level ? LEVEL_STRIPE[line.level] : line.stream === "stderr" ? "border-l-destructive/60" : "border-l-transparent", line.stream === "command" && "font-semibold", line.stream === "system" && "text-muted-foreground italic")}>
            {timestamps && line.timestamp !== undefined && (
              <time dateTime={new Date(line.timestamp).toISOString()} className="shrink-0 text-muted-foreground tabular-nums select-none">
                {time.format(line.timestamp)}
              </time>
            )}
            <span className={cn("min-w-0 flex-1", wrap ? "break-words whitespace-pre-wrap" : "whitespace-pre")}>
              {line.stream === "command" && <span className="text-muted-foreground select-none">{prompt} </span>}
              <AnsiText text={line.text} {...(needle ? { highlight: query.trim() } : {})} />
              {line.level === "error" && <span className="sr-only"> (error)</span>}
              {line.level === "warn" && <span className="sr-only"> (warning)</span>}
            </span>
          </div>
        ))}
        {lines.length === 0 && <p className="px-3 py-2 text-muted-foreground">{emptyMessage}</p>}
        {lines.length > 0 && filtered.length === 0 && <p className="px-3 py-2 text-muted-foreground">No lines match.</p>}
      </div>
      {!following && (
        <button
          type="button"
          onClick={() => {
            setFollowing(true);
            const element = scrollRef.current;
            if (element) element.scrollTop = element.scrollHeight;
          }}
          className={cn("absolute right-4 bottom-14 inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-md hover:bg-accent [&_svg]:size-3.5", !onCommand && "bottom-4", focusRing)}
        >
          <ArrowDownToLineIcon aria-hidden="true" />
          {unseen > 0 ? `${unseen} new ${unseen === 1 ? "line" : "lines"}` : "Jump to latest"}
        </button>
      )}
      {onCommand && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 font-mono text-xs">
          <label htmlFor={`${id}-command`} className="text-muted-foreground select-none">
            <span aria-hidden="true">{prompt}</span>
            <span className="sr-only">Command</span>
          </label>
          <input
            id={`${id}-command`}
            value={command}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setCommand(event.target.value);
              setHistoryIndex(null);
            }}
            onKeyDown={onCommandKeyDown}
            disabled={connection === "disconnected"}
            placeholder={connection === "disconnected" ? "Disconnected" : "Type a command and press Enter"}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
        </div>
      )}
    </section>
  );
}
