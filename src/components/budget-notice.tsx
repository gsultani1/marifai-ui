// packages/ai-ui/src/components/budget-notice.tsx
"use client";

import { CoinsIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { button, buttonVariants, focusRing, iconButton, type Tone, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount } from "../lib/format.js";
import { formatTokenCount } from "../lib/models.js";

export interface BudgetNoticeProps {
  /** Tokens the next message is expected to use. */
  estimatedTokens: number;
  estimatedCost?: number;
  /** Spent so far in the budget period. */
  spent?: number;
  budget?: number;
  /** e.g. "today" or "this month". */
  period?: string;
  currency?: string;
  /** Fraction of the budget, after this message, that turns the notice into a warning. */
  warnAt?: number;
  /** Opens a review of what will be sent, such as a context snapshot. */
  onReview?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/** Tone of the notice: neutral, then a warning near the budget and danger past it. */
export function budgetNoticeTone(spent: number | undefined, cost: number | undefined, budget: number | undefined, warnAt = 0.8): Tone {
  if (budget === undefined || budget <= 0 || cost === undefined) return "neutral";
  const after = (spent ?? 0) + cost;
  return after > budget ? "danger" : after >= budget * warnAt ? "warning" : "neutral";
}

/**
 * Pre-send estimate shown above the composer: tokens and cost of the next
 * message and where it leaves the budget, turning into a warning near the
 * limit and an alert past it.
 */
export function BudgetNotice({ estimatedTokens, estimatedCost, spent, budget, period = "today", currency = "USD", warnAt = 0.8, onReview, onDismiss, className }: BudgetNoticeProps) {
  const tone = budgetNoticeTone(spent, estimatedCost, budget, warnAt);
  const after = (spent ?? 0) + (estimatedCost ?? 0);
  const estimate = `About ${formatTokenCount(estimatedTokens)} tokens${estimatedCost !== undefined ? ` · ~${formatAmount(estimatedCost, currency)}` : ""}`;
  const budgetText =
    budget !== undefined && estimatedCost !== undefined
      ? tone === "danger"
        ? `This would put you ${formatAmount(after - budget, currency)} over your ${formatAmount(budget, currency)} budget for ${period}.`
        : `Brings ${period}'s spend to ${formatAmount(after, currency)} of ${formatAmount(budget, currency)}.`
      : "";

  return (
    <div role={tone === "neutral" ? "status" : "alert"} data-slot="budget-notice" data-tone={tone} className={cn("flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-xs", toneSurface[tone], className)}>
      {tone === "neutral" ? <CoinsIcon aria-hidden="true" className="size-3.5 text-muted-foreground" /> : <TriangleAlertIcon aria-hidden="true" className={cn("size-3.5", tone === "danger" ? "text-destructive" : "text-warning")} />}
      <span className="font-medium">{estimate}</span>
      {budgetText && <span className={cn(tone === "danger" && "font-medium")}>{budgetText}</span>}
      <span className="ml-auto flex items-center gap-1">
        {onReview && (
          <button type="button" onClick={onReview} className={cn(button, buttonVariants.ghost, "h-6 px-2 text-xs text-foreground", focusRing)}>
            Review context
          </button>
        )}
        {onDismiss && (
          <button type="button" aria-label="Dismiss estimate" title="Dismiss" onClick={onDismiss} className={cn(iconButton, "size-6", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  );
}
