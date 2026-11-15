// packages/ai-ui/src/components/review-comments.tsx
"use client";

import { CheckIcon, ChevronDownIcon, MessageSquareTextIcon, RotateCcwIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useId, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime, initials } from "../lib/format.js";
import { SegmentedControl } from "./segmented-control.js";

export interface ReviewAnchor {
  line: number;
  endLine?: number;
  file?: string;
  /** The text the comment refers to, as it was when commented. */
  quote?: string;
}

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  createdAt?: number;
}

export interface ReviewThread {
  id: string;
  anchor: ReviewAnchor;
  comments: ReviewComment[];
  resolved?: boolean;
}

export type ReviewFilter = "open" | "resolved" | "all";

export interface ReviewCommentsProps {
  threads: ReviewThread[];
  onReply?: (threadId: string, body: string) => void | Promise<void>;
  onResolve?: (threadId: string, resolved: boolean) => void;
  /** Scrolls the document to what a thread refers to. */
  onJump?: (anchor: ReviewAnchor) => void;
  /** Where a new comment is being written; shows its form at the top. */
  draftAnchor?: ReviewAnchor | null;
  onCreate?: (anchor: ReviewAnchor, body: string) => void | Promise<void>;
  onCancelDraft?: () => void;
  /** Highlights the thread the document cursor is on. */
  activeThreadId?: string;
  defaultFilter?: ReviewFilter;
  className?: string;
}

function anchorPhrase(anchor: ReviewAnchor): string {
  const lines = anchor.endLine && anchor.endLine !== anchor.line ? `lines ${anchor.line}–${anchor.endLine}` : `line ${anchor.line}`;
  return anchor.file ? `${anchor.file}, ${lines}` : lines;
}

/** "Line 12" or "Lines 12–14", after the file when there is one. */
export function formatAnchor(anchor: ReviewAnchor): string {
  const phrase = anchorPhrase(anchor);
  return anchor.file ? phrase : phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** Threads in document order: by file, then line. */
export function sortThreads(threads: readonly ReviewThread[]): ReviewThread[] {
  return [...threads].sort((a, b) => (a.anchor.file ?? "").localeCompare(b.anchor.file ?? "") || a.anchor.line - b.anchor.line || (a.anchor.endLine ?? a.anchor.line) - (b.anchor.endLine ?? b.anchor.line));
}

function CommentForm({ label, submitLabel, onSubmit, onCancel, autoFocus = false }: { label: string; submitLabel: string; onSubmit: (body: string) => void | Promise<void>; onCancel?: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = body.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
      setBody("");
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn't post the comment.");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    } else if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-1.5">
      <textarea
        aria-label={label}
        aria-describedby={error ? `${id}-error` : undefined}
        value={body}
        rows={2}
        autoFocus={autoFocus}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`${label}…`}
        className={cn("min-h-16 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground", focusRing, "focus-visible:ring-offset-0")}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={!body.trim() || busy} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * Review threads anchored to lines of a document or file: the quoted text,
 * the conversation, replies, resolve and reopen, filtering by state, and a
 * jump back to the anchor.
 */
export function ReviewComments({ threads, onReply, onResolve, onJump, draftAnchor, onCreate, onCancelDraft, activeThreadId, defaultFilter = "open", className }: ReviewCommentsProps) {
  const [filter, setFilter] = useState<ReviewFilter>(defaultFilter);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const now = useNow(60_000);
  const id = useId();
  const open = threads.filter((thread) => !thread.resolved).length;
  const shown = sortThreads(threads).filter((thread) => filter === "all" || (filter === "open" ? !thread.resolved : thread.resolved));

  return (
    <section aria-labelledby={`${id}-title`} data-slot="review-comments" className={cn("flex flex-col gap-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="flex items-center gap-2 font-medium">
          <MessageSquareTextIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          Comments
        </h3>
        <span className="text-xs text-muted-foreground">
          {open} open · {threads.length - open} resolved
        </span>
        <SegmentedControl
          label="Show"
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "all", label: "All" },
          ]}
          className="ml-auto"
        />
      </div>
      {draftAnchor && onCreate && (
        <div className={cn(card, "flex flex-col gap-2 border-ring p-3")}>
          <p className="text-xs font-medium">New comment on {anchorPhrase(draftAnchor)}</p>
          {draftAnchor.quote && <blockquote className="line-clamp-3 border-l-2 border-border pl-2 font-mono text-xs text-muted-foreground">{draftAnchor.quote}</blockquote>}
          <CommentForm label="Comment" submitLabel="Comment" autoFocus onSubmit={(body) => onCreate(draftAnchor, body)} {...(onCancelDraft ? { onCancel: onCancelDraft } : {})} />
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {shown.map((thread) => {
          const collapsed = Boolean(thread.resolved) && !expanded[thread.id];
          const first = thread.comments[0];
          return (
            <li key={thread.id} data-resolved={thread.resolved || undefined} aria-current={thread.id === activeThreadId ? "true" : undefined} className={cn(card, "flex flex-col gap-2 p-3", thread.id === activeThreadId && "border-ring ring-1 ring-ring")}>
              <div className="flex flex-wrap items-center gap-2">
                {onJump ? (
                  <button type="button" onClick={() => onJump(thread.anchor)} className={cn("rounded-sm text-xs font-medium underline-offset-2 hover:underline", focusRing)}>
                    {formatAnchor(thread.anchor)}
                  </button>
                ) : (
                  <span className="text-xs font-medium">{formatAnchor(thread.anchor)}</span>
                )}
                {thread.resolved && (
                  <span className={cn(badge, "border-success/40")}>
                    <CheckIcon aria-hidden="true" className="text-success" />
                    Resolved
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {thread.resolved && (
                    <button type="button" aria-expanded={!collapsed} onClick={() => setExpanded({ ...expanded, [thread.id]: collapsed })} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                      {collapsed ? `Show ${thread.comments.length} ${thread.comments.length === 1 ? "comment" : "comments"}` : "Hide"}
                      <ChevronDownIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", !collapsed && "rotate-180")} />
                    </button>
                  )}
                  {onResolve && (
                    <button type="button" onClick={() => onResolve(thread.id, !thread.resolved)} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                      {thread.resolved ? <RotateCcwIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
                      {thread.resolved ? "Reopen" : "Resolve"}
                    </button>
                  )}
                </span>
              </div>
              {thread.anchor.quote && !collapsed && <blockquote className="line-clamp-3 border-l-2 border-border pl-2 font-mono text-xs text-muted-foreground">{thread.anchor.quote}</blockquote>}
              {collapsed && first ? (
                <p className="truncate text-xs text-muted-foreground">
                  {first.author}: {first.body}
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {thread.comments.map((comment) => (
                    <li key={comment.id} className="flex gap-2">
                      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                        {initials(comment.author)}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="text-xs">
                          <span className="font-medium">{comment.author}</span>
                          {comment.createdAt !== undefined && <span className="text-muted-foreground"> · {formatRelativeTime(comment.createdAt, now)}</span>}
                        </p>
                        <p className="break-words whitespace-pre-wrap">{comment.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {!thread.resolved && onReply && <CommentForm label={`Reply on ${anchorPhrase(thread.anchor)}`} submitLabel="Reply" onSubmit={(body) => onReply(thread.id, body)} />}
            </li>
          );
        })}
      </ol>
      {shown.length === 0 && <p className="text-muted-foreground">{filter === "resolved" ? "No resolved comments." : filter === "open" ? "No open comments." : "No comments yet."}</p>}
    </section>
  );
}
