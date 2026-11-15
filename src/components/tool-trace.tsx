// packages/ai-ui/src/components/tool-trace.tsx
"use client";

import { BrainIcon, ChevronRightIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDuration } from "../lib/format.js";
import { StepStatusIcon } from "../lib/step-status.js";
import { CodeBlock } from "./code-block.js";

export type TraceToolStatus = "running" | "complete" | "failed";

export type TraceItem =
  | {
      kind: "tool";
      id: string;
      name: string;
      status: TraceToolStatus;
      input?: unknown;
      output?: unknown;
      error?: string;
      durationMs?: number;
    }
  | { kind: "reasoning"; id: string; text: string };

export interface ToolVerb {
  running: string;
  done: string;
  failed: string;
  /** Singular and plural nouns for grouped summaries, e.g. "file" and "files". */
  noun?: string;
  plural?: string;
  /** Pulls the target shown after the verb, e.g. a path or a command. */
  target?: (input: unknown) => string | undefined;
}

const field =
  (...keys: string[]) =>
  (input: unknown): string | undefined => {
    if (typeof input === "string") return input;
    if (typeof input !== "object" || input === null) return undefined;
    for (const key of keys) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return value;
    }
    return undefined;
  };

const VERBS: Array<[RegExp, ToolVerb]> = [
  [/read|view|open|cat/, { running: "Reading", done: "Read", failed: "Failed to read", noun: "file", plural: "files", target: field("path", "file", "filePath", "uri") }],
  [/write|create_file|save/, { running: "Writing", done: "Wrote", failed: "Failed to write", noun: "file", plural: "files", target: field("path", "file", "filePath") }],
  [/edit|patch|replace|apply/, { running: "Editing", done: "Edited", failed: "Failed to edit", noun: "file", plural: "files", target: field("path", "file", "filePath") }],
  [/delete|remove|unlink/, { running: "Deleting", done: "Deleted", failed: "Failed to delete", noun: "file", plural: "files", target: field("path", "file") }],
  [/list|ls|glob|tree/, { running: "Listing", done: "Listed", failed: "Failed to list", noun: "folder", plural: "folders", target: field("path", "dir", "directory", "pattern") }],
  [/web_search|search_web/, { running: "Searching the web for", done: "Searched the web for", failed: "Web search failed for", noun: "search", plural: "searches", target: field("query", "q") }],
  [/grep|search|find/, { running: "Searching", done: "Searched", failed: "Search failed", noun: "search", plural: "searches", target: field("query", "pattern", "q") }],
  [/fetch|browse|http|url/, { running: "Fetching", done: "Fetched", failed: "Failed to fetch", noun: "page", plural: "pages", target: field("url", "href") }],
  [/bash|shell|command|exec|run/, { running: "Running", done: "Ran", failed: "Failed to run", noun: "command", plural: "commands", target: field("command", "cmd", "script") }],
  [/deploy/, { running: "Deploying", done: "Deployed", failed: "Deploy failed", noun: "deploy", plural: "deploys" }],
  [/commit/, { running: "Committing", done: "Committed", failed: "Commit failed", noun: "commit", plural: "commits", target: field("message") }],
];

/** Plain-English verbs for a tool name, matched by keywords such as "read", "write" or "search". */
export function describeTool(name: string): ToolVerb {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const match = VERBS.find(([pattern]) => pattern.test(normalized));
  if (match) return match[1];
  const readable = name.replace(/[_-]+/g, " ");
  return { running: `Running ${readable}`, done: `Ran ${readable}`, failed: `${readable} failed`, noun: "call", plural: "calls" };
}

/** Keeps the last two path segments: "src/components/app.tsx" stays, deeper paths get a leading "…/". */
export function shortenPath(value: string, segments = 2): string {
  if (!value.includes("/") || /^[a-z]+:\/\//i.test(value)) return value;
  const parts = value.split("/").filter(Boolean);
  return parts.length <= segments ? value : `…/${parts.slice(-segments).join("/")}`;
}

type Row =
  | { type: "tool"; item: Extract<TraceItem, { kind: "tool" }> }
  | { type: "group"; name: string; items: Array<Extract<TraceItem, { kind: "tool" }>> }
  | { type: "reasoning"; item: Extract<TraceItem, { kind: "reasoning" }> };

/** Collapses consecutive finished calls of the same tool; running and failed calls stay separate so counts never flicker. */
export function groupTrace(items: readonly TraceItem[]): Row[] {
  const rows: Row[] = [];
  for (const item of items) {
    if (item.kind === "reasoning") {
      rows.push({ type: "reasoning", item });
      continue;
    }
    const last = rows.at(-1);
    const groupable = item.status === "complete";
    if (groupable && last?.type === "group" && last.name === item.name) {
      last.items.push(item);
    } else if (groupable && last?.type === "tool" && last.item.status === "complete" && last.item.name === item.name) {
      rows[rows.length - 1] = { type: "group", name: item.name, items: [last.item, item] };
    } else {
      rows.push({ type: "tool", item });
    }
  }
  return rows;
}

const clip = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value);
  return text.length > 2000 ? `${text.slice(0, 2000)}\n…` : text;
};

function Disclosure({ summary, children, status }: { summary: ReactNode; children: ReactNode; status?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn("group flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent/50", focusRing)}
      >
        {status}
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronRightIcon aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-90")} />
      </button>
      {open && <div className="flex flex-col gap-2 py-1.5 pl-7">{children}</div>}
    </div>
  );
}

function ToolDetails({ item }: { item: Extract<TraceItem, { kind: "tool" }> }) {
  return (
    <>
      {item.input !== undefined && <CodeBlock code={clip(item.input)} language={typeof item.input === "string" ? undefined : "json"} title="Input" />}
      {item.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs">{item.error}</p>}
      {item.output !== undefined && <CodeBlock code={clip(item.output)} language={typeof item.output === "string" ? undefined : "json"} title="Output" />}
    </>
  );
}

export interface ToolTraceProps extends Omit<ComponentProps<"ol">, "children"> {
  items: TraceItem[];
  /** Overrides the verbs used for a tool. */
  describe?: (name: string) => ToolVerb;
}

/**
 * Compact trace of an agent's reasoning and tool calls in plain English:
 * "Read …/app/page.tsx", "Ran npm test", "Read 4 files". Each row expands to
 * its input and output.
 */
export function ToolTrace({ items, describe = describeTool, className, ...props }: ToolTraceProps) {
  const rows = groupTrace(items);
  const summary = (item: Extract<TraceItem, { kind: "tool" }>) => {
    const verb = describe(item.name);
    const target = verb.target?.(item.input);
    const word = item.status === "running" ? verb.running : item.status === "failed" ? verb.failed : verb.done;
    return (
      <>
        {word}
        {target && <span className="font-mono text-xs"> {shortenPath(target)}</span>}
        {item.durationMs !== undefined && item.status !== "running" && (
          <span className="text-xs text-muted-foreground"> · {formatDuration(item.durationMs)}</span>
        )}
      </>
    );
  };

  return (
    <ol data-slot="tool-trace" className={cn("flex flex-col gap-0.5 text-sm", className)} {...props}>
      {rows.map((row) => {
        if (row.type === "reasoning") {
          return (
            <li key={row.item.id}>
              <Disclosure
                status={<BrainIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
                summary={<span className="text-muted-foreground italic">{row.item.text.split("\n")[0]}</span>}
              >
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{row.item.text}</p>
              </Disclosure>
            </li>
          );
        }
        if (row.type === "group") {
          const verb = describe(row.name);
          return (
            <li key={row.items[0]!.id}>
              <Disclosure
                status={<StepStatusIcon status="complete" />}
                summary={`${verb.done} ${row.items.length} ${verb.plural ?? "calls"}`}
              >
                <ol className="flex flex-col gap-0.5">
                  {row.items.map((item) => (
                    <li key={item.id}>
                      <Disclosure status={<StepStatusIcon status="complete" className="size-3.5" />} summary={summary(item)}>
                        <ToolDetails item={item} />
                      </Disclosure>
                    </li>
                  ))}
                </ol>
              </Disclosure>
            </li>
          );
        }
        return (
          <li key={row.item.id} data-status={row.item.status}>
            <Disclosure status={<StepStatusIcon status={row.item.status} />} summary={summary(row.item)}>
              <ToolDetails item={row.item} />
            </Disclosure>
          </li>
        );
      })}
    </ol>
  );
}
