// packages/ai-ui/src/components/run-budget-control.tsx
"use client";

import { Switch } from "@base-ui/react/switch";
import { useId } from "react";

import { focusRing, switchRoot, switchThumb } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount } from "../lib/format.js";
import { CurrencyInput, currencyFractionDigits } from "./number-input.js";

export interface FundingSource {
  id: string;
  /** e.g. "Team credits", "Your API key" or "Organization budget". */
  label: string;
  description?: string;
  /** Remaining balance in major units, shown beside the label. */
  balance?: number;
  disabled?: boolean;
  /** Why the source is unavailable. */
  reason?: string;
}

export interface RunBudgetControlProps {
  sources: FundingSource[];
  sourceId: string;
  onSourceChange: (id: string) => void;
  /** Most one message may spend, in minor units such as cents; null for no cap. */
  maxPerMessage: number | null;
  onMaxPerMessageChange: (minorUnits: number | null) => void;
  /** Quick choices in minor units. */
  presets?: number[];
  /** Stops the run when it reaches the cap instead of asking. */
  autoStop?: boolean;
  onAutoStopChange?: (autoStop: boolean) => void;
  currency?: string;
  className?: string;
}

/**
 * Who pays for a run and how much one message may spend: a funding source
 * with balances and unavailable sources explained, a per-message cap with
 * presets or a custom amount, and whether to stop or ask at the cap.
 */
export function RunBudgetControl({ sources, sourceId, onSourceChange, maxPerMessage, onMaxPerMessageChange, presets = [10, 50, 100, 500], autoStop, onAutoStopChange, currency = "USD", className }: RunBudgetControlProps) {
  const id = useId();
  const factor = 10 ** currencyFractionDigits(currency);

  return (
    <div data-slot="run-budget-control" className={cn("flex flex-col gap-4 text-sm", className)}>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 font-medium">Pay with</legend>
        {sources.map((source) => (
          <label key={source.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-ring has-[:checked]:bg-accent/40 has-[:disabled]:cursor-not-allowed has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <input type="radio" name={`${id}-source`} value={source.id} checked={source.id === sourceId} disabled={source.disabled ?? false} onChange={() => onSourceChange(source.id)} className="mt-0.5 size-4 accent-primary" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{source.label}</span>
                {source.balance !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{formatAmount(source.balance, currency)} left</span>}
              </span>
              {source.description && <span className="text-xs text-muted-foreground">{source.description}</span>}
              {source.disabled && source.reason && <span className="text-xs text-muted-foreground italic">{source.reason}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Most one message may spend</legend>
        <div role="group" aria-label="Quick amounts" className="flex flex-wrap gap-1">
          {presets.map((amount) => (
            <button key={amount} type="button" aria-pressed={maxPerMessage === amount} onClick={() => onMaxPerMessageChange(amount)} className={cn("h-7 rounded-md border border-border px-2.5 text-xs tabular-nums hover:bg-accent aria-pressed:border-ring aria-pressed:bg-accent", focusRing)}>
              {formatAmount(amount / factor, currency)}
            </button>
          ))}
          <button type="button" aria-pressed={maxPerMessage === null} onClick={() => onMaxPerMessageChange(null)} className={cn("h-7 rounded-md border border-border px-2.5 text-xs hover:bg-accent aria-pressed:border-ring aria-pressed:bg-accent", focusRing)}>
            No cap
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span id={`${id}-custom`} className="text-xs text-muted-foreground">
            Custom
          </span>
          <CurrencyInput aria-labelledby={`${id}-custom`} currency={currency} value={maxPerMessage} onValueCommitted={onMaxPerMessageChange} placeholder="No cap" className="w-32" />
        </div>
      </fieldset>
      {onAutoStopChange && (
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-medium">Stop at the cap</span>
            <span className="text-xs text-muted-foreground">{autoStop ? "The run stops when it reaches the cap." : "You're asked before the run spends more."}</span>
          </span>
          <Switch.Root aria-label="Stop at the cap" checked={autoStop ?? false} onCheckedChange={onAutoStopChange} className={cn(switchRoot, focusRing)}>
            <Switch.Thumb className={switchThumb} />
          </Switch.Root>
        </label>
      )}
    </div>
  );
}
