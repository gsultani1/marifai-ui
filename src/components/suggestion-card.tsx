// packages/ai-ui/src/components/suggestion-card.tsx
"use client";

import { FrownIcon, LightbulbIcon, MehIcon, SmileIcon, Undo2Icon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { badge, button, buttonVariants, card, focusRing, iconButton, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface SuggestedValue {
  field: string;
  label: string;
  current?: string;
  suggested: string;
  /** Why this value is suggested. */
  reason?: string;
}

export interface SuggestionCardProps {
  title: string;
  values: SuggestedValue[];
  /** Receives the values to apply, edited or as suggested. */
  onApply: (values: Record<string, string>) => void;
  /** Restores the values from before the last apply. */
  onUndo?: (previous: Record<string, string>) => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * AI-suggested values for a form, each beside the current value with its
 * reasoning: apply as suggested, edit first ("use as a starting point"),
 * or dismiss, with an undo that restores the previous values.
 */
export function SuggestionCard({ title, values, onApply, onUndo, onDismiss, className }: SuggestionCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const signature = values.map((value) => `${value.field}\u0000${value.suggested}`).join("\u0001");
  const [applied, setApplied] = useState<{ signature: string; previous: Record<string, string> } | null>(null);
  const backup = applied?.signature === signature ? applied.previous : null;
  const id = useId();
  const suggested = () => Object.fromEntries(values.map((value) => [value.field, value.suggested]));

  const apply = (next: Record<string, string>) => {
    setApplied({ signature, previous: Object.fromEntries(values.map((value) => [value.field, value.current ?? ""])) });
    onApply(next);
    setEditing(false);
  };

  if (backup) {
    return (
      <div role="status" data-slot="suggestion-card" className={cn(card, "flex flex-wrap items-center gap-2 px-3 py-2 text-sm", className)}>
        <span className="flex-1">Applied the suggested {values.length === 1 ? "value" : "values"}.</span>
        {onUndo && (
          <button
            type="button"
            onClick={() => {
              onUndo(backup);
              setApplied(null);
            }}
            className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}
          >
            <Undo2Icon aria-hidden="true" />
            Undo
          </button>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} data-slot="suggestion-card" className={cn(card, "flex flex-col gap-2 border-ring/60 p-3 text-sm", className)}>
      <div className="flex items-center gap-2">
        <LightbulbIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        {onDismiss && (
          <button type="button" aria-label="Dismiss suggestion" title="Dismiss" onClick={onDismiss} className={cn(iconButton, "ml-auto size-7", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </div>
      <dl className="flex flex-col gap-2">
        {values.map((value) => (
          <div key={value.field} className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium">{value.label}</dt>
            <dd className="flex flex-col gap-0.5">
              {editing ? (
                <>
                  <label htmlFor={`${id}-${value.field}`} className="sr-only">
                    {value.label}
                  </label>
                  <input id={`${id}-${value.field}`} value={draft[value.field] ?? ""} onChange={(event) => setDraft({ ...draft, [value.field]: event.target.value })} className={cn(input, "h-8", focusRing, "focus-visible:ring-offset-0")} />
                </>
              ) : (
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {value.current !== undefined && value.current !== value.suggested && (
                    <>
                      <del className="text-muted-foreground">
                        <span className="sr-only">current: </span>
                        {value.current || "empty"}
                      </del>
                      <span aria-hidden="true" className="text-muted-foreground">
                        →
                      </span>
                    </>
                  )}
                  <ins className="font-medium no-underline">
                    <span className="sr-only">suggested: </span>
                    {value.suggested}
                  </ins>
                </span>
              )}
              {value.reason && <span className="text-xs text-muted-foreground">{value.reason}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-end gap-2">
        {editing ? (
          <>
            <button type="button" onClick={() => setEditing(false)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
              Cancel
            </button>
            <button type="button" onClick={() => apply(draft)} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
              Apply edited
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setDraft(suggested());
                setEditing(true);
              }}
              className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}
            >
              Use as a starting point
            </button>
            <button type="button" onClick={() => apply(suggested())} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
              Apply
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export interface SentimentBadgeProps {
  /** -1 (negative) to 1 (positive). */
  score: number;
  /** Shows the score beside the label. */
  showScore?: boolean;
  className?: string;
}

/** "Positive", "Neutral" or "Negative" from a score, with an icon and the score on hover or beside it. */
export function sentimentLabel(score: number): "Positive" | "Neutral" | "Negative" {
  return score >= 0.25 ? "Positive" : score <= -0.25 ? "Negative" : "Neutral";
}

/** Sentiment of a review or message in words, with a matching icon and the score. */
export function SentimentBadge({ score, showScore = false, className }: SentimentBadgeProps) {
  const label = sentimentLabel(score);
  const value = Math.max(-1, Math.min(1, score)).toFixed(2);
  return (
    <span data-slot="sentiment-badge" data-sentiment={label.toLowerCase()} title={`Sentiment score ${value}`} className={cn(badge, label === "Positive" ? "border-success/40" : label === "Negative" ? "border-destructive/40" : "", className)}>
      {label === "Positive" ? <SmileIcon aria-hidden="true" className="text-success" /> : label === "Negative" ? <FrownIcon aria-hidden="true" className="text-destructive" /> : <MehIcon aria-hidden="true" className="text-muted-foreground" />}
      {label}
      {showScore ? <span className="font-normal text-muted-foreground tabular-nums">{value}</span> : <span className="sr-only">, score {value}</span>}
    </span>
  );
}
