// packages/ai-ui/src/components/budget-bar.tsx
import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";
import { formatAmount } from "../lib/format.js";

export interface BudgetBarProps extends Omit<ComponentProps<"div">, "children"> {
  budget: number;
  used: number;
  /** Reserved by running or approved work but not yet spent. */
  held?: number;
  /** ISO currency code or a unit word such as "credits". */
  unit?: string;
  label?: string;
  /** Fractions of the budget where the bar turns amber and red. */
  warnAt?: number;
  alertAt?: number;
}

/** Spend against a budget: used, held for running work, and what is left. */
export function BudgetBar({ budget, used, held = 0, unit = "USD", label = "Budget", warnAt = 0.75, alertAt = 0.9, className, ...props }: BudgetBarProps) {
  const total = Math.max(0, budget);
  const spent = Math.max(0, used);
  const reserved = Math.max(0, held);
  const committed = spent + reserved;
  const left = total - committed;
  const ratio = total > 0 ? committed / total : committed > 0 ? 1 : 0;
  const tone = ratio >= alertAt ? "bg-destructive" : ratio >= warnAt ? "bg-warning" : "bg-primary";
  const pct = (value: number) => (total > 0 ? `${Math.min(100, (value / total) * 100)}%` : "0%");
  const summary = `${formatAmount(spent, unit)} used${reserved > 0 ? `, ${formatAmount(reserved, unit)} held` : ""}, ${left >= 0 ? `${formatAmount(left, unit)} left` : `${formatAmount(-left, unit)} over`} of ${formatAmount(total, unit)}`;

  return (
    <div data-slot="budget-bar" data-level={ratio >= alertAt ? "alert" : ratio >= warnAt ? "warn" : "ok"} className={cn("flex flex-col gap-1.5 text-sm", className)} {...props}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className={cn("text-xs tabular-nums", left < 0 ? "text-destructive" : "text-muted-foreground")}>
          {left >= 0 ? `${formatAmount(left, unit)} left` : `${formatAmount(-left, unit)} over budget`}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(committed, total)}
        aria-valuetext={summary}
        className="flex h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full transition-[width] motion-reduce:transition-none", tone)} style={{ width: pct(spent) }} />
        {reserved > 0 && (
          <div
            className="h-full bg-[repeating-linear-gradient(45deg,var(--muted-foreground)_0_3px,transparent_3px_6px)] opacity-60"
            style={{ width: pct(Math.min(reserved, Math.max(0, total - spent))) }}
          />
        )}
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
        <span>Used {formatAmount(spent, unit)}</span>
        {reserved > 0 && <span>Held {formatAmount(reserved, unit)}</span>}
        <span>Budget {formatAmount(total, unit)}</span>
      </p>
    </div>
  );
}
