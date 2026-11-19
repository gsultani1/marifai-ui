// packages/ai-ui/src/experimental/task-conflict-review.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, ItemList, comparisonGrid, contentBlock } from "../lib/component-controls.js";

export type TaskConflictSide = "current" | "incoming";
export interface TaskFieldConflict { id: string; field: string; current: string; incoming: string }
export interface ResolvedTaskField { id: string; side: TaskConflictSide }

export interface TaskConflictReviewProps {
  conflicts: readonly TaskFieldConflict[];
  onSubmit: (decisions: ResolvedTaskField[]) => void | Promise<void>;
  className?: string;
}

export function TaskConflictReview({ conflicts, onSubmit, className }: TaskConflictReviewProps) {
  const [chosen,setChosen] = useState(() => new Map<string,TaskConflictSide>());
  const decisions = conflicts.flatMap((item) => {
    const side = chosen.get(item.id);
    return side ? [{id:item.id,side}] : [];
  });
  return <ControlPanel slot="task-conflict-review" title="Resolve task conflicts" className={className}>
    <AsyncForm label="Resolve task conflicts" submitLabel="Apply resolutions" disabled={!conflicts.length}
      onSubmit={() => {
        if (decisions.length !== conflicts.length) throw new Error("Choose a value for every field.");
        return onSubmit(decisions);
      }}>
      <ItemList items={conflicts} empty="No conflicting fields." render={(item) => <>
        <div className={comparisonGrid}>
          <div><h4 className="text-sm font-medium">Current</h4><p className={contentBlock}>{item.current}</p></div>
          <div><h4 className="text-sm font-medium">Incoming</h4><p className={contentBlock}>{item.incoming}</p></div>
        </div>
        <ChoiceField label={"Value for " + item.field} value={chosen.get(item.id) ?? ""} placeholder="Choose a value"
          options={[{value:"current",label:"Current"},{value:"incoming",label:"Incoming"}]} onChange={(value) => {
            setChosen((old) => {
              const next = new Map(old);
              if (value) next.set(item.id,value); else next.delete(item.id);
              return next;
            });
          }} />
      </>} />
    </AsyncForm>
  </ControlPanel>;
}
