// packages/ai-ui/src/components/context-meter.tsx
"use client";

import { ChevronDownIcon, CopyIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";
import { formatTokenCount } from "../lib/models.js";

export interface ContextSegment {
  /** e.g. "System", "History", "Retrieved", "Input" or "Tools". */
  label: string;
  tokens: number;
  /** CSS color; defaults to the chart palette in order. */
  color?: string;
}

export type ContextLevel = "ok" | "warning" | "critical";

/** "ok" below `warnAt`, "warning" from it, "critical" from `alertAt` (fractions of the limit). */
export function contextLevel(used: number, limit: number, warnAt = 0.7, alertAt = 0.9): ContextLevel {
  const ratio = limit > 0 ? used / limit : 0;
  return ratio >= alertAt ? "critical" : ratio >= warnAt ? "warning" : "ok";
}

const LEVEL_TEXT: Record<ContextLevel, string> = {
  ok: "Plenty of room",
  warning: "Getting full; older messages may be summarized",
  critical: "Almost full; start a new chat or remove context",
};

export interface ContextMeterProps {
  used: number;
  limit: number;
  /** Where the tokens go; the remainder of `used` shows as "Other". */
  segments?: ContextSegment[];
  warnAt?: number;
  alertAt?: number;
  label?: string;
  /** A single bar and percentage, with the breakdown on request. */
  compact?: boolean;
  className?: string;
}

/**
 * How much of the model's context window a conversation uses: a meter
 * split by where the tokens go, warning and critical thresholds, and what
 * that means in words.
 */
export function ContextMeter({ used, limit, segments = [], warnAt = 0.7, alertAt = 0.9, label = "Context", compact = false, className }: ContextMeterProps) {
  const [open, setOpen] = useState(!compact);
  const id = useId();
  const level = contextLevel(used, limit, warnAt, alertAt);
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const accounted = segments.reduce((sum, segment) => sum + segment.tokens, 0);
  const parts = [...segments, ...(used > accounted ? [{ label: "Other", tokens: used - accounted, color: "var(--muted-foreground)" }] : [])].map((segment, index) => ({ ...segment, color: segment.color ?? `var(--chart-${(index % 8) + 1})` }));

  return (
    <div data-slot="context-meter" data-level={level} className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <div className="flex items-center gap-2">
        <span id={`${id}-label`} className="font-medium">
          {label}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTokenCount(used)} of {formatTokenCount(limit)} · {Math.round(percent)}%
        </span>
        {compact && parts.length > 0 && (
          <button type="button" aria-expanded={open} aria-controls={`${id}-legend`} onClick={() => setOpen(!open)} className={cn(button, buttonVariants.ghost, "ml-auto h-6 px-1.5 text-xs", focusRing)}>
            Breakdown
            <ChevronDownIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
          </button>
        )}
      </div>
      <div
        role="meter"
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${formatTokenCount(used)} of ${formatTokenCount(limit)} tokens, ${Math.round(percent)}%. ${LEVEL_TEXT[level]}`}
        className={cn("relative flex h-2 overflow-hidden rounded-full bg-muted", level === "critical" && "ring-1 ring-destructive")}
      >
        {parts.map((part) => (
          <span key={part.label} className="h-full" style={{ width: `${limit > 0 ? (part.tokens / limit) * 100 : 0}%`, background: part.color }} />
        ))}
        {parts.length === 0 && <span className={cn("h-full", level === "critical" ? "bg-destructive" : level === "warning" ? "bg-warning" : "bg-primary")} style={{ width: `${percent}%` }} />}
        <span aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${warnAt * 100}%` }} />
        <span aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${alertAt * 100}%` }} />
      </div>
      <p className={cn("text-xs", level === "critical" ? "font-medium text-destructive" : level === "warning" ? "font-medium" : "text-muted-foreground")}>{LEVEL_TEXT[level]}</p>
      {open && parts.length > 0 && (
        <ul id={`${id}-legend`} aria-label={`${label} breakdown`} className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {parts.map((part) => (
            <li key={part.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-sm" style={{ background: part.color }} />
              {part.label}
              <span className="text-muted-foreground tabular-nums">{formatTokenCount(part.tokens)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ContextSnapshotItem {
  id: string;
  label: string;
  detail?: string;
  tokens?: number;
}

export interface ContextSnapshotSection {
  id: string;
  /** e.g. "System prompt", "Messages", "Files", "Retrieved passages" or "Tools". */
  label: string;
  tokens?: number;
  items?: ContextSnapshotItem[];
  /** Full text, such as the system prompt. */
  content?: string;
}

export interface ContextSnapshotProps {
  sections: ContextSnapshotSection[];
  /** "sent" describes a finished request; "pending" what the next message will send, with items removable. */
  mode?: "sent" | "pending";
  model?: string;
  createdAt?: number;
  /** Leaves an item out of the next request (pending mode). */
  onRemoveItem?: (sectionId: string, itemId: string) => void;
  className?: string;
}

/**
 * Exactly what the model saw, or what the next message will send: each
 * part of the context with its tokens, expandable to its items or text,
 * removable before sending, and copyable as JSON.
 */
export function ContextSnapshot({ sections, mode = "sent", model, createdAt, onRemoveItem, className }: ContextSnapshotProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { copied, copy } = useCopyToClipboard();
  const now = useNow(60_000);
  const id = useId();
  const total = sections.reduce((sum, section) => sum + (section.tokens ?? (section.items ?? []).reduce((count, item) => count + (item.tokens ?? 0), 0)), 0);
  const title = mode === "sent" ? "What the model saw" : "What will be sent";

  const toggle = (sectionId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });

  return (
    <section aria-labelledby={`${id}-title`} data-slot="context-snapshot" data-mode={mode} className={cn(card, "flex flex-col text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          {[model, `${formatTokenCount(total)} tokens`, createdAt !== undefined ? formatRelativeTime(createdAt, now) : ""].filter(Boolean).join(" · ")}
        </span>
        <button type="button" aria-label={copied ? "Copied" : "Copy as JSON"} title="Copy as JSON" onClick={() => void copy(JSON.stringify({ mode, model, createdAt, sections }, null, 2))} className={cn(iconButton, "ml-auto size-7", focusRing)}>
          <CopyIcon aria-hidden="true" />
        </button>
      </div>
      <ul className="divide-y divide-border">
        {sections.map((section) => {
          const expandable = Boolean(section.content || section.items?.length);
          const expanded = open.has(section.id);
          const tokens = section.tokens ?? (section.items ?? []).reduce((count, item) => count + (item.tokens ?? 0), 0);
          return (
            <li key={section.id} className="flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2">
                {expandable ? (
                  <button type="button" aria-expanded={expanded} aria-controls={`${id}-${section.id}`} onClick={() => toggle(section.id)} className={cn("flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left font-medium", focusRing)}>
                    <ChevronDownIcon aria-hidden="true" className={cn("size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform motion-reduce:transition-none", expanded && "rotate-0")} />
                    {section.label}
                    {section.items && <span className="font-normal text-muted-foreground">({section.items.length})</span>}
                  </button>
                ) : (
                  <span className="flex-1 pl-5 font-medium">{section.label}</span>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">{formatTokenCount(tokens)}</span>
              </div>
              {expanded && (
                <div id={`${id}-${section.id}`} className="px-3 pb-2 pl-8">
                  {section.content && (
                    <pre tabIndex={0} aria-label={`${section.label} text`} className={cn("max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap", focusRing)}>
                      {section.content}
                    </pre>
                  )}
                  {section.items && (
                    <ul className="flex flex-col gap-1">
                      {section.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-xs">
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                            {item.detail && <span className="text-muted-foreground"> · {item.detail}</span>}
                          </span>
                          {item.tokens !== undefined && <span className="text-muted-foreground tabular-nums">{formatTokenCount(item.tokens)}</span>}
                          {mode === "pending" && onRemoveItem && (
                            <button type="button" aria-label={`Leave out ${item.label}`} title="Leave out" onClick={() => onRemoveItem(section.id, item.id)} className={cn(iconButton, "size-6", focusRing)}>
                              <XIcon aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
