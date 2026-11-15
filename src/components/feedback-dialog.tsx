// packages/ai-ui/src/components/feedback-dialog.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { button, buttonVariants, focusRing, iconButton, modalBackdrop, modalPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export interface FeedbackSubmission {
  rating: "up" | "down";
  categories: string[];
  comment: string;
  /** What the answer should have said, when given. */
  correction: string;
  shareConversation: boolean;
}

export interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rating: "up" | "down";
  onSubmit: (feedback: FeedbackSubmission) => void | Promise<void>;
  categories?: string[];
  /** Adds an optional "share this conversation" checkbox with this explanation. */
  shareLabel?: string;
}

export const NEGATIVE_FEEDBACK_CATEGORIES = ["Not factually correct", "Didn't follow instructions", "Incomplete or too short", "Too long", "Wrong or broken code", "Unsafe or inappropriate", "Other"];
export const POSITIVE_FEEDBACK_CATEGORIES = ["Correct", "Easy to understand", "Saved me time", "Good code", "Other"];

/**
 * Follow-up after thumbs up or down: reason chips, a comment, a suggested
 * correction for poor answers, and an explicit choice about sharing the
 * conversation. Pair with MessageFeedbackActions.
 */
export function FeedbackDialog({ open, onOpenChange, rating, onSubmit, categories, shareLabel }: FeedbackDialogProps) {
  const options = categories ?? (rating === "down" ? NEGATIVE_FEEDBACK_CATEGORIES : POSITIVE_FEEDBACK_CATEGORIES);
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [correction, setCorrection] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const container = usePortalContainer();
  const id = useId();

  const reset = () => {
    setSelected([]);
    setComment("");
    setCorrection("");
    setShare(false);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ rating, categories: selected, comment: comment.trim(), correction: correction.trim(), shareConversation: share });
      reset();
      onOpenChange(false);
    } catch {
      setError("Couldn't send your feedback. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={modalBackdrop} />
        <Dialog.Popup className={modalPopup}>
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <Dialog.Title className="text-base font-semibold">{rating === "down" ? "What went wrong?" : "What did you like?"}</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">Your feedback helps improve future answers.</Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className={cn(iconButton, focusRing)}>
                <XIcon aria-hidden="true" />
              </Dialog.Close>
            </div>
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Reasons</legend>
              {options.map((option) => {
                const on = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected(on ? selected.filter((item) => item !== option) : [...selected, option])}
                    className={cn("h-7 rounded-full border border-border px-2.5 text-xs font-medium hover:bg-accent aria-pressed:border-foreground/30 aria-pressed:bg-accent", focusRing)}
                  >
                    {option}
                  </button>
                );
              })}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-comment`} className="text-sm font-medium">
                Details <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea id={`${id}-comment`} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} className={cn("w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm", focusRing, "focus-visible:ring-offset-0")} />
            </div>
            {rating === "down" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-correction`} className="text-sm font-medium">
                  What should the answer have said? <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea id={`${id}-correction`} rows={3} value={correction} onChange={(event) => setCorrection(event.target.value)} className={cn("w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm", focusRing, "focus-visible:ring-offset-0")} />
              </div>
            )}
            {shareLabel && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
                <span>{shareLabel}</span>
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close className={cn(button, buttonVariants.outline, focusRing)}>Cancel</Dialog.Close>
              <button type="submit" disabled={busy} className={cn(button, buttonVariants.primary, focusRing)}>
                {busy && <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                Send feedback
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
