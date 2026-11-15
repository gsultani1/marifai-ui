// packages/ai-ui/src/components/tool-audit-log.tsx
"use client";

import { ChevronRightIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { badge, card, focusRing, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDuration } from "../lib/format.js";
import { FilterChips } from "./filter-chips.js";
import { JsonViewer } from "./json-viewer.js";
import { SearchInput } from "./search-input.js";

export type ToolAuditStatus = "success" | "error" | "denied";

export interface ToolAuditEntry {
  id: string;
  tool: string;
  /** MCP server or integration that provided the tool. */
  server?: string;
  status: ToolAuditStatus;
  at: number;
  durationMs?: number;
  /** Who or what triggered the call, e.g. an agent or user. */
  actor?: string;
  args?: unknown;
  /** Short result or error text. */
  result?: string;
}

const STATUS: Record<ToolAuditStatus, { label: string; tone: Tone }> = {
  success: { label: "Succeeded", tone: "success" },
  error: { label: "Failed", tone: "danger" },
  denied: { label: "Denied", tone: "warning" },
};

/** Entries whose tool, server, actor, result or arguments contain the query, case-insensitively. */
export function filterAuditEntries(entries: readonly ToolAuditEntry[], query: string, statuses: readonly ToolAuditStatus[] = []): ToolAuditEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (statuses.length && !statuses.includes(entry.status)) return false;
    if (!needle) return true;
    return [entry.tool, entry.server ?? "", entry.actor ?? "", entry.result ?? "", entry.args === undefined ? "" : JSON.stringify(entry.args)].some((field) => field.toLowerCase().includes(needle));
  });
}

export interface ToolAuditLogProps {
  entries: ToolAuditEntry[];
  label?: string;
  className?: string;
}

/**
 * A record of every tool call: status (succeeded, failed or denied), tool
 * and server, who triggered it, when and how long it took, filterable by
 * status and searchable, with arguments and results on expansion.
 */
export function ToolAuditLog({ entries, label = "Tool activity", className }: ToolAuditLogProps) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const id = useId();
  const shown = useMemo(() => filterAuditEntries(entries, query, statuses as ToolAuditStatus[]).sort((a, b) => b.at - a.at), [entries, query, statuses]);
  const counts = (status: ToolAuditStatus) => entries.filter((entry) => entry.status === status).length;

  const toggle = (entryId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });

  return (
    <section aria-labelledby={`${id}-title`} data-slot="tool-audit-log" className={cn(card, "flex flex-col text-sm", className)}>
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
        <h3 id={`${id}-title`} className="font-medium">
          {label}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput label="Search tool calls" value={query} onValueChange={setQuery} placeholder="Search tools, servers, arguments" resultCount={shown.length} className="min-w-48 flex-1" />
          <FilterChips
            label="Status"
            value={statuses}
            onValueChange={setStatuses}
            options={(Object.keys(STATUS) as ToolAuditStatus[]).map((status) => ({ value: status, label: STATUS[status].label, count: counts(status) }))}
          />
        </div>
      </div>
      <ol className="divide-y divide-border">
        {shown.map((entry) => {
          const status = STATUS[entry.status];
          const expandable = entry.args !== undefined || Boolean(entry.result);
          const expanded = open.has(entry.id);
          return (
            <li key={entry.id} data-status={entry.status} className="flex flex-col">
              <button type="button" aria-expanded={expandable ? expanded : undefined} aria-controls={expandable ? `${id}-${entry.id}` : undefined} disabled={!expandable} onClick={() => toggle(entry.id)} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-accent/40 disabled:hover:bg-transparent", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                <ChevronRightIcon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", expanded && "rotate-90", !expandable && "invisible")} />
                <span className="font-mono text-xs font-medium">{entry.tool}</span>
                {entry.server && <span className="text-xs text-muted-foreground">{entry.server}</span>}
                <span className={badge}>
                  <span aria-hidden="true" className={cn("size-2 rounded-full", toneDot[status.tone])} />
                  {status.label}
                </span>
                <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  {entry.actor && <span>{entry.actor}</span>}
                  {entry.durationMs !== undefined && <span>{entry.durationMs < 1000 ? `${Math.round(entry.durationMs)} ms` : formatDuration(entry.durationMs)}</span>}
                  <time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
                </span>
              </button>
              {expanded && (
                <div id={`${id}-${entry.id}`} className="flex flex-col gap-2 px-3 pb-3 pl-10">
                  {entry.result && <p className={cn("text-xs", entry.status === "error" ? "font-medium text-destructive" : "")}>{entry.result}</p>}
                  {entry.args !== undefined && <JsonViewer value={entry.args} label={`${entry.tool} arguments`} defaultExpandDepth={2} searchable={false} className="max-h-64" />}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {shown.length === 0 && <p className="px-3 py-3 text-muted-foreground">{entries.length ? "No tool calls match." : "No tool calls yet."}</p>}
    </section>
  );
}
