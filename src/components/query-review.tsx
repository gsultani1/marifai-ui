// packages/ai-ui/src/components/query-review.tsx
"use client";

import { DatabaseIcon, LoaderCircleIcon, PencilIcon, PlayIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { isReadOnlySql } from "../lib/sql.js";
import { CodeBlock } from "./code-block.js";

export interface QueryReviewProps extends Omit<ComponentProps<"section">, "title" | "onError"> {
  /** SQL proposed by the assistant. */
  sql: string;
  title?: ReactNode;
  /** The request the SQL answers, shown above it. */
  description?: ReactNode;
  onRun: (sql: string) => void | Promise<void>;
  onDismiss?: () => void;
  /** Lets statements that change data run after an explicit confirmation. */
  allowWrites?: boolean;
  /** Rendered results of the last run. */
  result?: ReactNode;
  error?: string;
  runLabel?: string;
}

/**
 * Review step for generated SQL: read it, edit it, then run it. Statements
 * that change data are blocked unless writes are allowed, and then need a
 * separate confirmation.
 */
export function QueryReview({
  sql,
  title = "Review the query",
  description,
  onRun,
  onDismiss,
  allowWrites = false,
  result,
  error,
  runLabel = "Run query",
  className,
  ...props
}: QueryReviewProps) {
  const [draft, setDraft] = useState(sql);
  const [source, setSource] = useState(sql);
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const id = useId();
  if (source !== sql) {
    setSource(sql);
    setDraft(sql);
    setConfirmed(false);
  }
  const readOnly = isReadOnlySql(draft);
  const edited = draft !== sql;
  const blocked = !draft.trim() || (!readOnly && (!allowWrites || !confirmed));

  const run = () => {
    if (blocked || pending) return;
    const outcome = onRun(draft);
    if (!(outcome instanceof Promise)) return;
    setPending(true);
    outcome.finally(() => setPending(false)).catch(() => undefined);
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="query-review" data-read-only={readOnly} className={cn(card, "flex flex-col gap-3 p-3 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        <DatabaseIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        <span className={badge}>{readOnly ? "Read only" : "Changes data"}</span>
        {edited && <span className={badge}>Edited</span>}
      </div>
      {description && <p className="text-muted-foreground">{description}</p>}
      {editing ? (
        <label className="flex flex-col gap-1">
          <span className="sr-only">SQL</span>
          <textarea
            value={draft}
            spellCheck={false}
            rows={Math.min(14, Math.max(4, draft.split("\n").length + 1))}
            onChange={(event) => {
              setDraft(event.target.value);
              setConfirmed(false);
            }}
            className={cn("rounded-md border border-input bg-code-background px-3 py-2 font-mono text-xs text-code-foreground", focusRing)}
          />
        </label>
      ) : (
        <CodeBlock code={draft} language="sql" />
      )}
      {!readOnly && draft.trim() && (
        <div className={cn("flex flex-col gap-2 rounded-md border px-3 py-2", allowWrites ? "border-warning/50 bg-warning/10" : "border-destructive/40 bg-destructive/10")}>
          <p className="flex items-start gap-2">
            <TriangleAlertIcon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", allowWrites ? "text-warning" : "text-destructive")} />
            {allowWrites ? "This query changes data or the schema. Check it before running." : "This query changes data or the schema, and only read queries can run here."}
          </p>
          {allowWrites && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className={cn("size-4 accent-primary", focusRing)} />
              I understand this query changes data
            </label>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs whitespace-pre-wrap">
          {error}
        </p>
      )}
      {result && <div className="overflow-auto">{result}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)} className={cn(button, buttonVariants.ghost, focusRing)}>
          <PencilIcon aria-hidden="true" />
          {editing ? "Done editing" : "Edit"}
        </button>
        {edited && (
          <button
            type="button"
            onClick={() => {
              setDraft(sql);
              setConfirmed(false);
            }}
            className={cn(button, buttonVariants.ghost, focusRing)}
          >
            <RotateCcwIcon aria-hidden="true" />
            Reset
          </button>
        )}
        <span className="ml-auto flex gap-2">
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={cn(button, buttonVariants.outline, focusRing)}>
              Dismiss
            </button>
          )}
          <button type="button" aria-disabled={blocked || pending || undefined} onClick={run} className={cn(button, readOnly ? buttonVariants.primary : buttonVariants.destructive, focusRing)}>
            {pending ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <PlayIcon aria-hidden="true" />}
            {readOnly ? runLabel : "Run write query"}
          </button>
        </span>
      </div>
    </section>
  );
}
