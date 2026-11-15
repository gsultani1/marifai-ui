// packages/ai-ui/src/components/tracked-changes.tsx
"use client";

import { diffWordsWithSpace } from "diff";
import { CheckIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type TrackedSegment = { type: "same"; text: string } | { type: "change"; id: number; removed: string; added: string };

/** Word-level changes between two texts, with adjacent removals and insertions joined into replacements. */
export function trackedSegments(original: string, revised: string): TrackedSegment[] {
  const segments: TrackedSegment[] = [];
  let id = 0;
  for (const part of diffWordsWithSpace(original, revised)) {
    const last = segments[segments.length - 1];
    if (!part.added && !part.removed) segments.push({ type: "same", text: part.value });
    else if (last?.type === "change" && ((part.added && !last.added) || (part.removed && !last.removed && !last.added))) {
      if (part.added) last.added = part.value;
      else last.removed = part.value;
    } else segments.push({ type: "change", id: id++, removed: part.removed ? part.value : "", added: part.added ? part.value : "" });
  }
  return segments;
}

/** The text after applying decisions: accepted changes use the revision, rejected ones the original, undecided ones `fallback`. */
export function resolveTrackedChanges(segments: TrackedSegment[], decisions: Record<number, "accept" | "reject">, fallback: "accept" | "reject" = "accept"): string {
  return segments.map((segment) => (segment.type === "same" ? segment.text : (decisions[segment.id] ?? fallback) === "accept" ? segment.added : segment.removed)).join("");
}

export interface TrackedChangesProps {
  original: string;
  revised: string;
  /** Receives the resolved text; undecided changes are accepted. */
  onResolve: (text: string) => void;
  /** Who proposed the changes, e.g. "Marifai". */
  author?: string;
  className?: string;
}

const describe = (removed: string, added: string) => (removed && added ? `replace "${removed.trim()}" with "${added.trim()}"` : added ? `insert "${added.trim()}"` : `delete "${removed.trim()}"`);

/**
 * Suggested edits to prose shown like tracked changes in a word processor:
 * insertions underlined, deletions struck through, each with accept and
 * reject, plus accept all, reject all and finish.
 */
export function TrackedChanges({ original, revised, onResolve, author = "Suggested", className }: TrackedChangesProps) {
  const segments = trackedSegments(original, revised);
  const signature = `${original.length}:${revised.length}:${segments.length}`;
  const [state, setState] = useState<{ signature: string; decisions: Record<number, "accept" | "reject"> }>({ signature, decisions: {} });
  const decisions = state.signature === signature ? state.decisions : {};
  const id = useId();
  const changes = segments.filter((segment): segment is Extract<TrackedSegment, { type: "change" }> => segment.type === "change");
  const pending = changes.filter((change) => !decisions[change.id]).length;
  const decide = (changeId: number, decision: "accept" | "reject") => setState({ signature, decisions: { ...decisions, [changeId]: decision } });
  const decideAll = (decision: "accept" | "reject") => setState({ signature, decisions: Object.fromEntries(changes.map((change) => [change.id, decision])) });

  const rendered: ReactNode[] = segments.map((segment, index) => {
    if (segment.type === "same") return <span key={index}>{segment.text}</span>;
    const decision = decisions[segment.id];
    if (decision === "accept") return <span key={index}>{segment.added}</span>;
    if (decision === "reject") return <span key={index}>{segment.removed}</span>;
    const label = describe(segment.removed, segment.added);
    return (
      <span key={index} data-change={segment.id} className="rounded-sm px-0.5 ring-1 ring-border">
        {segment.removed && (
          <del className="text-destructive decoration-2">
            <span className="sr-only">deleted: </span>
            {segment.removed}
          </del>
        )}
        {segment.added && (
          <ins className="text-success decoration-2 underline-offset-2">
            <span className="sr-only">inserted: </span>
            {segment.added}
          </ins>
        )}
        <span className="mx-0.5 inline-flex translate-y-0.5 gap-0.5 align-baseline">
          <button type="button" aria-label={`Accept change ${segment.id + 1}: ${label}`} title="Accept" onClick={() => decide(segment.id, "accept")} className={cn("inline-flex size-5 items-center justify-center rounded text-success hover:bg-background [&_svg]:size-3.5", focusRing)}>
            <CheckIcon aria-hidden="true" />
          </button>
          <button type="button" aria-label={`Reject change ${segment.id + 1}: ${label}`} title="Reject" onClick={() => decide(segment.id, "reject")} className={cn("inline-flex size-5 items-center justify-center rounded text-destructive hover:bg-background [&_svg]:size-3.5", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        </span>
      </span>
    );
  });

  return (
    <section aria-labelledby={`${id}-title`} data-slot="tracked-changes" className={cn(card, "flex flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm">
        <h3 id={`${id}-title`} className="font-medium">
          {author} edits
        </h3>
        <span role="status" className="text-xs text-muted-foreground">
          {pending === 0 ? "All changes reviewed" : `${pending} of ${changes.length} to review`}
        </span>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => decideAll("accept")} disabled={!changes.length} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Accept all
          </button>
          <button type="button" onClick={() => decideAll("reject")} disabled={!changes.length} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Reject all
          </button>
        </div>
      </div>
      <div className="px-4 py-3 text-sm leading-7 whitespace-pre-wrap">{rendered}</div>
      <div className="flex justify-end border-t border-border px-3 py-2">
        <button type="button" onClick={() => onResolve(resolveTrackedChanges(segments, decisions))} className={cn(button, buttonVariants.primary, focusRing)}>
          {pending ? `Finish, accepting ${pending} remaining` : "Finish"}
        </button>
      </div>
    </section>
  );
}
