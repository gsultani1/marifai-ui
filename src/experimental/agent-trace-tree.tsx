// packages/ai-ui/src/experimental/agent-trace-tree.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { LabeledTree } from "../lib/collection-controls.js";
export interface AgentTraceSpan { id: string; label: string; durationMs?: number; status?: string; children?: readonly AgentTraceSpan[] }

export interface AgentTraceTreeProps {
  spans: readonly AgentTraceSpan[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function AgentTraceTree({ spans, activeId = null, onSelect, className }: AgentTraceTreeProps) {
  return <ControlPanel slot="agent-trace-tree" title="Run trace" className={className}>
    <LabeledTree items={spans} label="Trace spans" activeId={activeId} onSelect={onSelect}
      detail={(span) => [span.status, span.durationMs === undefined ? null : span.durationMs + " ms"].filter(Boolean).join(" · ")} />
  </ControlPanel>;
}
