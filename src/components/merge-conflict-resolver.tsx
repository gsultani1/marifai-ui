// packages/ai-ui/src/components/merge-conflict-resolver.tsx
"use client";

import { ControlAction, ControlPanel, ItemList } from "../lib/component-controls.js";
import { DiffView } from "./diff-view.js";

export type MergeConflictChoice = "current" | "incoming" | "both";
export interface MergeConflict { id: string; file: string; current: string; incoming: string; choice?: MergeConflictChoice }
export interface MergeConflictResolverProps {
  conflicts: readonly MergeConflict[];
  onResolve: (id: string, choice: MergeConflictChoice) => void;
  pendingIds?: readonly string[];
  className?: string;
}
const options = [{ value: "current", label: "Use current" }, { value: "incoming", label: "Use incoming" }, { value: "both", label: "Use both" }] as const;
const resolved: Record<MergeConflictChoice, string> = { current: "Resolved: kept the current change.", incoming: "Resolved: kept the incoming change.", both: "Resolved: kept both changes." };
export function MergeConflictResolver({ conflicts, onResolve, pendingIds = [], className }: MergeConflictResolverProps) {
  return <ControlPanel slot="merge-conflict-resolver" title="Merge conflicts" className={className}>
    <ItemList items={conflicts} empty="No merge conflicts." render={(item) => {
      const busy = pendingIds.includes(item.id);
      return <>
        <h4 className="text-sm font-medium break-words">{item.file}</h4>
        <DiffView oldValue={item.current} newValue={item.incoming} oldTitle="Current" newTitle="Incoming" />
        {/* The status stays mounted so screen readers announce the resolution after the choice buttons go away. */}
        <p role="status" className="text-sm">{item.choice ? resolved[item.choice] : busy ? "Resolving…" : "Unresolved"}</p>
        {!item.choice && <div className="flex flex-wrap gap-2">
          {options.map(({ value, label }) => <ControlAction key={value} label={label} item={item.file}
            disabled={busy} onClick={() => onResolve(item.id, value)} />)}
        </div>}
      </>;
    }} />
  </ControlPanel>;
}
