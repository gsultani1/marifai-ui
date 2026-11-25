// packages/ai-ui/src/components/delegation-tree.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { LabeledTree } from "../lib/collection-controls.js";
export interface DelegationRun { id: string; label: string; agent: string; status: string; children?: readonly DelegationRun[] }

export interface DelegationTreeProps {
  runs: readonly DelegationRun[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

export function DelegationTree({ runs, activeId = null, onSelect = undefined, className }: DelegationTreeProps) {
  return <ControlPanel slot="delegation-tree" title="Delegations" className={className}>
    <LabeledTree items={runs} label="Delegated runs" activeId={activeId} onSelect={onSelect} detail={(item) => item.agent + " · " + item.status} />
  </ControlPanel>;
}
