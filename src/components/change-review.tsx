// packages/ai-ui/src/components/change-review.tsx
"use client";

import { useId, useState } from "react";

import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { applyHunkSelection, diffHunks, hunkStats } from "../lib/patch.js";
import { PatchHunkView } from "./patch-hunk.js";

export interface ChangeReviewProps {
  oldValue: string;
  newValue: string;
  /** Receives the text with only the accepted changes applied. */
  onApply: (result: string, accepted: number, total: number) => void;
  onDiscard?: () => void;
  fileName?: string;
  /** Unchanged lines shown around each change. */
  context?: number;
  className?: string;
}

/**
 * Accept or reject a proposed edit change by change: every hunk has its
 * own checkbox, Accept all and Reject all set them together, and Apply
 * writes only the accepted ones.
 */
export function ChangeReview({ oldValue, newValue, onApply, onDiscard, fileName, context = 3, className }: ChangeReviewProps) {
  const hunks = diffHunks(oldValue, newValue, context);
  const signature = `${hunks.length}:${oldValue.length}:${newValue.length}`;
  const [state, setState] = useState<{ signature: string; accepted: boolean[] }>({ signature, accepted: hunks.map(() => true) });
  const accepted = state.signature === signature ? state.accepted : hunks.map(() => true);
  const id = useId();
  const count = accepted.filter(Boolean).length;
  const setAll = (value: boolean) => setState({ signature, accepted: hunks.map(() => value) });

  return (
    <section aria-labelledby={`${id}-title`} data-slot="change-review" className={cn(card, "flex flex-col overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h3 id={`${id}-title`} className="text-sm font-medium">
          {fileName ? `Changes to ${fileName}` : "Proposed changes"}
        </h3>
        <span className="text-xs text-muted-foreground">
          {count} of {hunks.length} accepted
        </span>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setAll(true)} disabled={count === hunks.length} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Accept all
          </button>
          <button type="button" onClick={() => setAll(false)} disabled={count === 0} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            Reject all
          </button>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {hunks.map((hunk, index) => {
          const stats = hunkStats(hunk);
          return (
            <div key={`${hunk.oldStart}-${hunk.newStart}`} data-accepted={accepted[index]} className={cn(!accepted[index] && "bg-muted/40 [&_[data-slot=patch-hunk]]:line-through [&_[data-slot=patch-hunk]]:decoration-muted-foreground/60")}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={accepted[index] ?? false}
                  onChange={(event) => setState({ signature, accepted: accepted.map((value, position) => (position === index ? event.target.checked : value)) })}
                  className="size-4 accent-primary"
                />
                <span className="font-medium">Change {index + 1}</span>
                {!accepted[index] && <span className="rounded bg-muted px-1.5 font-medium">Rejected</span>}
                <span className="text-muted-foreground">
                  line {hunk.oldStart}, +{stats.additions} −{stats.deletions}
                </span>
              </label>
              <PatchHunkView hunk={hunk} />
            </div>
          );
        })}
        {hunks.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No differences.</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
        {onDiscard && (
          <button type="button" onClick={onDiscard} className={cn(button, buttonVariants.ghost, focusRing)}>
            Discard
          </button>
        )}
        <button type="button" disabled={!hunks.length} onClick={() => onApply(applyHunkSelection(oldValue, hunks, accepted), count, hunks.length)} className={cn(button, buttonVariants.primary, focusRing)}>
          {count === hunks.length ? "Apply all changes" : `Apply ${count} of ${hunks.length} changes`}
        </button>
      </div>
    </section>
  );
}
