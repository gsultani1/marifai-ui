// packages/ai-ui/src/experimental/agent-run-comparison.tsx
"use client";

import { ControlPanel, comparisonGrid } from "../lib/component-controls.js";

export interface ComparedAgentRun { label: string; outcome: string; elapsedMs?: number; toolCalls?: number; cost?: number }

export interface AgentRunComparisonProps {
  left: ComparedAgentRun;
  right: ComparedAgentRun;
  currency: string;
  className?: string;
}

export function AgentRunComparison({ left, right, currency, className }: AgentRunComparisonProps) {
  return <ControlPanel slot="agent-run-comparison" title="Compare agent runs" className={className}>
    <div className={comparisonGrid}>{[left, right].map((run, index) => <div key={index} className="space-y-2 rounded border border-border p-2">
      <h4 className="text-sm font-medium break-words">{run.label}</h4>
      <dl className="space-y-1 text-sm">
        <div><dt className="inline text-muted-foreground">Outcome </dt><dd className="inline">{run.outcome}</dd></div>
        <div><dt className="inline text-muted-foreground">Elapsed </dt><dd className="inline">{run.elapsedMs === undefined ? "Unavailable" : run.elapsedMs + " ms"}</dd></div>
        <div><dt className="inline text-muted-foreground">Tool calls </dt><dd className="inline">{run.toolCalls ?? "Unavailable"}</dd></div>
        <div><dt className="inline text-muted-foreground">Cost </dt><dd className="inline">{run.cost === undefined ? "Unavailable" : run.cost + " " + currency}</dd></div>
      </dl>
    </div>)}</div>
  </ControlPanel>;
}
