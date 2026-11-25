// packages/ai-ui/src/components/agent-run-comparison.tsx
"use client";

import { useId } from "react";

import { ControlPanel, comparisonGrid } from "../lib/component-controls.js";
import { formatAmount } from "../lib/format.js";

export interface ComparedAgentRun { label: string; outcome: string; elapsedMs?: number; toolCalls?: number; cost?: number }

export interface AgentRunComparisonProps {
  left: ComparedAgentRun;
  right: ComparedAgentRun;
  currency: string;
  className?: string;
}

export function AgentRunComparison({ left, right, currency, className }: AgentRunComparisonProps) {
  const id = useId();
  return <ControlPanel slot="agent-run-comparison" title="Compare agent runs" className={className}>
    <div className={comparisonGrid}>{[left, right].map((run, index) => <div key={index} role="group" aria-labelledby={id + "-" + index} className="space-y-2 rounded border border-border p-2">
      <h4 id={id + "-" + index} className="text-sm font-medium break-words">{run.label}</h4>
      <dl className="space-y-1 text-sm">
        <div><dt className="inline text-muted-foreground">Outcome </dt><dd className="inline">{run.outcome}</dd></div>
        <div><dt className="inline text-muted-foreground">Elapsed </dt><dd className="inline">{run.elapsedMs === undefined ? "Unavailable" : run.elapsedMs + " ms"}</dd></div>
        <div><dt className="inline text-muted-foreground">Tool calls </dt><dd className="inline">{run.toolCalls ?? "Unavailable"}</dd></div>
        <div><dt className="inline text-muted-foreground">Cost </dt><dd className="inline">{run.cost === undefined ? "Unavailable" : formatAmount(run.cost, currency)}</dd></div>
      </dl>
    </div>)}</div>
  </ControlPanel>;
}
