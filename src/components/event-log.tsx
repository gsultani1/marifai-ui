// packages/ai-ui/src/components/event-log.tsx
"use client";

import { ChevronRightIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { focusRing, iconButton, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { toDate } from "../lib/dates.js";
import type { LogLevel } from "../lib/log-buffer.js";
import { FilterChips } from "./filter-chips.js";
import { JsonViewer } from "./json-viewer.js";
import { SearchInput } from "./search-input.js";

export interface LogEvent {
  id: string;
  time: Date | string | number;
  level: LogLevel;
  /** Where it came from, e.g. "worker" or "billing". */
  source?: string;
  message: string;
  /** Shown when the row is expanded; objects render as JSON. */
  details?: unknown;
}

export interface EventLogProps {
  events: LogEvent[];
  order?: "newest-first" | "oldest-first";
  onClear?: () => void;
  /** Rows rendered at most after filtering. */
  maxRendered?: number;
  label?: string;
  locale?: string;
  className?: string;
}

const LEVELS: Record<LogLevel, { label: string; tone: Tone }> = {
  debug: { label: "Debug", tone: "neutral" },
  info: { label: "Info", tone: "info" },
  warn: { label: "Warning", tone: "warning" },
  error: { label: "Error", tone: "danger" },
};

/** Structured events with level filters and counts, search across messages, sources and details, and rows that expand to their details. */
export function EventLog({ events, order = "newest-first", onClear, maxRendered = 500, label = "Events", locale, className }: EventLogProps) {
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<string[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const id = useId();
  const needle = query.trim().toLowerCase();
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const matches = (event: LogEvent) => (!levels.length || levels.includes(event.level)) && (!needle || `${event.message} ${event.source ?? ""} ${event.details === undefined ? "" : typeof event.details === "string" ? event.details : JSON.stringify(event.details)}`.toLowerCase().includes(needle));
  const ordered = order === "newest-first" ? [...events].reverse() : events;
  const filtered = ordered.filter(matches);
  const shown = filtered.slice(0, maxRendered);
  const counts = (Object.keys(LEVELS) as LogLevel[]).map((level) => ({ level, count: events.filter((event) => event.level === level).length })).filter((item) => item.count > 0);

  const toggle = (eventId: string) => {
    const next = new Set(open);
    if (next.has(eventId)) next.delete(eventId);
    else next.add(eventId);
    setOpen(next);
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="event-log" className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h3 id={`${id}-title`} className="font-medium">
          {label}
        </h3>
        <SearchInput label={`Search ${label.toLowerCase()}`} placeholder="Search" value={query} onValueChange={setQuery} resultCount={filtered.length} className="w-44 max-w-full [&_input]:h-7" />
        {counts.length > 1 && <FilterChips label="Levels" value={levels} onValueChange={setLevels} clearLabel={false} options={counts.map(({ level, count }) => ({ value: level, label: LEVELS[level].label, count }))} />}
        {onClear && (
          <button type="button" aria-label={`Clear ${label.toLowerCase()}`} title="Clear" disabled={!events.length} onClick={onClear} className={cn(iconButton, "ml-auto size-7", focusRing)}>
            <Trash2Icon aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {shown.map((event) => {
          const level = LEVELS[event.level];
          const date = toDate(event.time);
          const expanded = open.has(event.id);
          const summary = (
            <>
              <time dateTime={date.toISOString()} title={date.toISOString()} className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                {time.format(date)}
              </time>
              <span className="inline-flex w-20 shrink-0 items-center gap-1.5 text-xs font-medium">
                <span aria-hidden="true" className={cn("size-2 rounded-full", toneDot[level.tone])} />
                {level.label}
              </span>
              {event.source && <span className="shrink-0 font-mono text-xs text-muted-foreground">{event.source}</span>}
              <span className="min-w-0 flex-1 truncate">{event.message}</span>
            </>
          );
          return (
            <li key={event.id} data-level={event.level}>
              {event.details === undefined ? (
                <div className="flex items-center gap-3 py-1.5 pr-3 pl-8">{summary}</div>
              ) : (
                <>
                  <button type="button" aria-expanded={expanded} aria-controls={`${id}-details-${event.id}`} onClick={() => toggle(event.id)} className={cn("flex w-full items-center gap-3 py-1.5 pr-3 pl-2 text-left hover:bg-accent/50", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                    <ChevronRightIcon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", expanded && "rotate-90")} />
                    {summary}
                  </button>
                  {expanded && (
                    <div id={`${id}-details-${event.id}`} className="px-8 pb-2">
                      {typeof event.details === "string" ? <pre className="font-mono text-xs break-words whitespace-pre-wrap">{event.details}</pre> : <JsonViewer value={event.details} defaultExpandDepth={2} label={`Details of ${event.message}`} />}
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
        {events.length === 0 && <li className="px-3 py-6 text-center text-muted-foreground">No events yet.</li>}
        {events.length > 0 && filtered.length === 0 && <li className="px-3 py-6 text-center text-muted-foreground">No events match.</li>}
      </ul>
      {filtered.length > shown.length && <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">Showing {shown.length} of {filtered.length.toLocaleString()} events. Search or filter to narrow them.</p>}
    </section>
  );
}
