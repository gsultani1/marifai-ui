// packages/ai-ui/src/components/run-budget-breakdown.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";

export interface RunBudgetAmounts { reserved?: string; settled?: string; released?: string; uncertain?: string }

export interface RunBudgetBreakdownProps {
  /** Exact decimal strings from the host, already formatted for display. */
  amounts: RunBudgetAmounts;
  currency: string;
  className?: string;
}

const labels = { reserved: "Reserved", settled: "Settled", released: "Released", uncertain: "Uncertain" } as const;

export function RunBudgetBreakdown({ amounts, currency, className }: RunBudgetBreakdownProps) {
  return <ControlPanel slot="run-budget-breakdown" title="Run budget breakdown" className={className}>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => <div key={key}>
        <dt className="text-muted-foreground">{labels[key]}</dt>
        <dd className="tabular-nums">{amounts[key] === undefined ? "Unavailable" : amounts[key] + " " + currency}</dd>
      </div>)}
    </dl>
  </ControlPanel>;
}
