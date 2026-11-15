// packages/ai-ui/src/components/debug-variable-tree.tsx
"use client";

import { LabeledTree } from "../lib/collection-controls.js";
import { ControlPanel } from "../lib/component-controls.js";

export interface DebugVariable { id: string; label: string; value?: string; type?: string; children?: readonly DebugVariable[] }
export interface DebugVariableTreeProps { scopes: readonly DebugVariable[]; className?: string }
export function DebugVariableTree({ scopes, className }: DebugVariableTreeProps) {
  return <ControlPanel slot="debug-variable-tree" title="Debug variables" className={className}>
    <LabeledTree items={scopes} label="Variable scopes" detail={(item) => [item.type, item.value].filter(Boolean).join(" · ")} />
  </ControlPanel>;
}
