// packages/ai-ui/src/components/json-viewer.tsx
"use client";

import { ChevronRightIcon, CopyIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const CHUNK = 100;

/** JavaScript-style path for a key sequence: $.items[2]["first name"]. */
export function jsonPath(path: Array<string | number>): string {
  return path.reduce<string>((acc, key) => (typeof key === "number" ? `${acc}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${acc}.${key}` : `${acc}[${JSON.stringify(key)}]`), "$");
}

function isContainer(value: unknown): value is JsonValue[] | Record<string, JsonValue> {
  return typeof value === "object" && value !== null;
}

function entriesOf(value: JsonValue[] | Record<string, JsonValue>): Array<[string | number, JsonValue]> {
  return Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
}

function matches(value: JsonValue, key: string | number | undefined, query: string): boolean {
  if (!query) return true;
  if (key !== undefined && String(key).toLowerCase().includes(query)) return true;
  if (!isContainer(value)) return String(value).toLowerCase().includes(query);
  return entriesOf(value).some(([childKey, child]) => matches(child, childKey, query));
}

function Primitive({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-code-keyword">null</span>;
  if (typeof value === "string") return <span className="break-all text-code-string">{JSON.stringify(value)}</span>;
  if (typeof value === "number") return <span className="text-code-number">{String(value)}</span>;
  return <span className="text-code-keyword">{String(value)}</span>;
}

interface NodeProps {
  name: string | number | undefined;
  value: JsonValue;
  path: Array<string | number>;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
  query: string;
  onCopyPath: (path: string) => void;
  idPrefix: string;
  focused: string;
}

function JsonNode({ name, value, path, depth, expanded, toggle, query, onCopyPath, idPrefix, focused }: NodeProps) {
  const key = jsonPath(path);
  const container = isContainer(value);
  const open = container && (expanded.has(key) || (query !== "" && matches(value, undefined, query)));
  const [limit, setLimit] = useState(CHUNK);
  const entries = container ? entriesOf(value) : [];
  const shown = query ? entries.filter(([childKey, child]) => matches(child, childKey, query)) : entries;
  const summary = Array.isArray(value) ? `Array(${value.length})` : container ? `{${Object.keys(value).length}}` : null;
  const label = (
    <>
      {name !== undefined && (
        <>
          <span className={typeof name === "number" ? "text-muted-foreground" : "text-code-property"}>{typeof name === "number" ? name : JSON.stringify(name).slice(1, -1)}</span>
          <span className="text-muted-foreground">: </span>
        </>
      )}
      {container ? <span className="text-muted-foreground">{summary}</span> : <Primitive value={value} />}
    </>
  );

  return (
    <li
      role="treeitem"
      id={`${idPrefix}${key}`}
      aria-expanded={container ? open : undefined}
      aria-level={depth + 1}
      data-path={key}
      className="font-mono text-xs leading-6"
    >
      <div data-focused={focused === key || undefined} className="group flex items-start gap-1 rounded hover:bg-accent/50" style={{ paddingLeft: depth * 14 }}>
        {container ? (
          <span aria-hidden="true" onClick={() => toggle(key)} className="mt-1 cursor-pointer text-muted-foreground">
            <ChevronRightIcon className={cn("size-3.5 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1" onClick={() => container && toggle(key)}>
          {label}
        </span>
        <button type="button" tabIndex={-1} aria-label={`Copy path ${key}`} onClick={() => onCopyPath(key)} className={cn(iconButton, "size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}>
          <CopyIcon aria-hidden="true" />
        </button>
      </div>
      {open && (
        <ul role="group">
          {shown.slice(0, limit).map(([childKey, child]) => (
            <JsonNode key={String(childKey)} name={childKey} value={child} path={[...path, childKey]} depth={depth + 1} expanded={expanded} toggle={toggle} query={query} onCopyPath={onCopyPath} idPrefix={idPrefix} focused={focused} />
          ))}
          {shown.length > limit && (
            <li role="none" style={{ paddingLeft: (depth + 1) * 14 + 18 }}>
              <button type="button" onClick={() => setLimit(limit + CHUNK)} className={cn("rounded text-xs text-primary underline-offset-2 hover:underline", focusRing)}>
                Show {Math.min(CHUNK, shown.length - limit)} more of {shown.length - limit}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export interface JsonViewerProps extends Omit<ComponentProps<"div">, "children"> {
  /** Parsed value, or JSON text to parse. */
  value?: unknown;
  json?: string;
  /** Levels opened on first render. */
  defaultExpandDepth?: number;
  label?: string;
  searchable?: boolean;
}

function collectKeys(value: JsonValue, path: Array<string | number>, depth: number, limit: number, out: Set<string>) {
  if (!isContainer(value) || depth >= limit) return;
  out.add(jsonPath(path));
  for (const [key, child] of entriesOf(value).slice(0, CHUNK)) collectKeys(child, [...path, key], depth + 1, limit, out);
}

/**
 * Collapsible JSON tree with search, expand and collapse all, copy path and
 * value, large arrays shown in chunks, and tree keyboard navigation (arrows,
 * Home, End). Invalid JSON shows the parse error and the raw text.
 */
export function JsonViewer({ value, json, defaultExpandDepth = 1, label = "JSON", searchable = true, className, ...props }: JsonViewerProps) {
  const parsed = useMemo((): { ok: true; value: JsonValue } | { ok: false; error: string } => {
    if (json === undefined) return { ok: true, value: (value ?? null) as JsonValue };
    try {
      return { ok: true, value: JSON.parse(json) as JsonValue };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" };
    }
  }, [json, value]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    if (parsed.ok) collectKeys(parsed.value, [], 0, defaultExpandDepth, keys);
    return keys;
  });
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState("$");
  const { status, copy } = useCopyToClipboard();
  const treeRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const idPrefix = `${id}-`;

  if (!parsed.ok) {
    return (
      <div data-slot="json-viewer" className={cn("flex flex-col gap-2 text-sm", className)} {...props}>
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          This is not valid JSON: {parsed.error}
        </p>
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs" tabIndex={0}>
          {json}
        </pre>
      </div>
    );
  }

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visibleItems = () => [...(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = visibleItems();
    const index = items.findIndex((item) => item.dataset.path === focused);
    const current = items[index];
    const move = (next: HTMLElement | undefined) => {
      if (!next?.dataset.path) return;
      event.preventDefault();
      setFocused(next.dataset.path);
      next.scrollIntoView({ block: "nearest" });
    };
    switch (event.key) {
      case "ArrowDown":
        move(items[index + 1]);
        break;
      case "ArrowUp":
        move(items[index - 1]);
        break;
      case "Home":
        move(items[0]);
        break;
      case "End":
        move(items.at(-1));
        break;
      case "ArrowRight":
        if (current?.getAttribute("aria-expanded") === "false") {
          event.preventDefault();
          toggle(focused);
        } else if (current?.getAttribute("aria-expanded") === "true") move(items[index + 1]);
        break;
      case "ArrowLeft":
        if (current?.getAttribute("aria-expanded") === "true") {
          event.preventDefault();
          toggle(focused);
        } else move(current?.parentElement?.closest<HTMLElement>('[role="treeitem"]') ?? undefined);
        break;
      case "Enter":
      case " ":
        if (current?.hasAttribute("aria-expanded")) {
          event.preventDefault();
          toggle(focused);
        }
        break;
    }
  };

  const expandAll = () => {
    const keys = new Set<string>();
    collectKeys(parsed.value, [], 0, 64, keys);
    setExpanded(keys);
  };

  return (
    <div data-slot="json-viewer" className={cn("flex min-h-0 flex-col gap-2 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <input
            type="search"
            aria-label="Filter keys and values"
            placeholder="Filter keys and values"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn("h-7 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-xs", focusRing)}
          />
        )}
        <button type="button" onClick={expandAll} className={cn("h-7 rounded-md px-2 text-xs hover:bg-accent", focusRing)}>
          Expand all
        </button>
        <button type="button" onClick={() => setExpanded(new Set())} className={cn("h-7 rounded-md px-2 text-xs hover:bg-accent", focusRing)}>
          Collapse all
        </button>
        <button type="button" onClick={() => void copy(JSON.stringify(parsed.value, null, 2))} className={cn("h-7 rounded-md px-2 text-xs hover:bg-accent", focusRing)}>
          {status === "copied" ? "Copied" : "Copy JSON"}
        </button>
        <span role="status" className="sr-only">
          {status === "copied" ? "Copied" : ""}
        </span>
      </div>
      <ul
        ref={treeRef}
        role="tree"
        aria-label={label}
        tabIndex={0}
        aria-activedescendant={`${idPrefix}${focused}`}
        onKeyDown={onKeyDown}
        className={cn("min-h-0 overflow-auto rounded-md border border-border bg-background p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:[&_[data-focused]]:bg-accent focus-visible:[&_[data-focused]]:ring-1 focus-visible:[&_[data-focused]]:ring-ring")}
      >
        <JsonNode name={undefined} value={parsed.value} path={[]} depth={0} expanded={expanded} toggle={toggle} query={query.trim().toLowerCase()} onCopyPath={(path) => void copy(path)} idPrefix={idPrefix} focused={focused} />
      </ul>
    </div>
  );
}
