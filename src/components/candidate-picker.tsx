// packages/ai-ui/src/components/candidate-picker.tsx
"use client";

import { ImageOffIcon, LoaderCircleIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { badge, button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount } from "../lib/format.js";
import { safeImageSrc } from "../lib/safe-url.js";

export interface Candidate {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  sku?: string;
  price?: number;
  /** Why it matched, e.g. "Exact SKU" or "Same size". */
  matched?: string;
}

export interface CandidatePickerProps {
  /** e.g. "Which 3/4 in. PVC elbow did you mean?" */
  question: string;
  candidates: Candidate[];
  defaultValue?: string;
  /** Confirms the choice; the list stays locked until the promise settles. */
  onSelect: (id: string) => void | Promise<void>;
  /** None of the candidates is right. */
  onNone?: () => void;
  onReport?: () => void;
  /** Progress through several items being matched one at a time. */
  progress?: { matched: number; total: number };
  currency?: string;
  className?: string;
}

/**
 * Asks which of several candidates the user meant: cards with image, SKU,
 * price and why each matched, one choice confirmed at a time with the list
 * locked while it saves, "none of these", reporting a bad match, and
 * progress when several items are matched in turn.
 */
export function CandidatePicker({ question, candidates, defaultValue, onSelect, onNone, onReport, progress, currency = "USD", className }: CandidatePickerProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSelect(value);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn't save the choice.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} aria-busy={busy || undefined} data-slot="candidate-picker" className={cn("flex flex-col gap-3 text-sm", className)}>
      {progress && (
        <div className="flex items-center gap-2 text-xs">
          <div role="progressbar" aria-label="Items matched" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.matched} aria-valuetext={`${progress.matched} of ${progress.total} matched`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${progress.total ? (progress.matched / progress.total) * 100 : 0}%` }} />
          </div>
          <span className="tabular-nums">
            {progress.matched} of {progress.total} matched
          </span>
        </div>
      )}
      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend id={`${id}-question`} className="mb-1 font-medium">
          {question}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {candidates.map((candidate) => {
            const src = safeImageSrc(candidate.image);
            return (
              <label key={candidate.id} className="flex cursor-pointer gap-3 rounded-lg border border-border p-2 has-[:checked]:border-ring has-[:checked]:ring-2 has-[:checked]:ring-ring has-[:disabled]:cursor-wait has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                <input type="radio" name={`${id}-candidate`} value={candidate.id} checked={value === candidate.id} onChange={() => setValue(candidate.id)} className="sr-only" />
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {src ? <img src={src} alt="" className="size-full object-cover" /> : <ImageOffIcon aria-hidden="true" className="size-5 text-muted-foreground" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{candidate.title}</span>
                  {candidate.subtitle && <span className="text-xs text-muted-foreground">{candidate.subtitle}</span>}
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {candidate.sku && <span className="font-mono text-muted-foreground">SKU {candidate.sku}</span>}
                    {candidate.price !== undefined && <span className="font-medium tabular-nums">{formatAmount(candidate.price, currency)}</span>}
                    {candidate.matched && <span className={cn(badge, "border-success/40")}>{candidate.matched}</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {onReport && (
          <button type="button" disabled={busy} onClick={onReport} className={cn("rounded-sm text-xs underline underline-offset-2", focusRing)}>
            Report a bad match
          </button>
        )}
        <span className="ml-auto flex gap-2">
          {onNone && (
            <button type="button" disabled={busy} onClick={onNone} className={cn(button, buttonVariants.ghost, focusRing)}>
              None of these
            </button>
          )}
          <button type="submit" disabled={!value || busy} className={cn(button, buttonVariants.primary, focusRing)}>
            {busy && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
            {busy ? "Saving…" : "Use this one"}
          </button>
        </span>
      </div>
    </form>
  );
}
