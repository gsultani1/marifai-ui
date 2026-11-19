// packages/ai-ui/src/components/task-conflict-review.tsx
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

/** A choice only counts for the exact values it was made against. */
function choiceKey(item: TaskFieldConflict) {
  return JSON.stringify([item.id, item.current, item.incoming]);
}

export function TaskConflictReview({ conflicts, onSubmit, className }: TaskConflictReviewProps) {
  const [chosen,setChosen] = useState(() => new Map<string,TaskConflictSide>());
  const decisions = conflicts.flatMap((item) => {
    const side = chosen.get(choiceKey(item));
    return side ? [{id:item.id,side}] : [];
  });
  return <ControlPanel slot="task-conflict-review" title="Resolve task conflicts" className={className}>
    <AsyncForm label="Resolve task conflicts" submitLabel="Apply resolutions" disabled={!conflicts.length}
      onSubmit={() => {
        if (decisions.length !== conflicts.length) throw new Error("Choose a value for every field.");
        return onSubmit(decisions);
      }}>
      <ItemList items={conflicts} empty="No conflicting fields." render={(item) => <>
        <h4 className="text-sm font-medium break-words">{item.field}</h4>
        <dl className={comparisonGrid}>
          <div className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">Current</dt><dd className={contentBlock}>{item.current}</dd></div>
          <div className="min-w-0 space-y-1"><dt className="text-xs text-muted-foreground">Incoming</dt><dd className={contentBlock}>{item.incoming}</dd></div>
        </dl>
        <ChoiceField label={"Value for " + item.field} value={chosen.get(choiceKey(item)) ?? ""} placeholder="Choose a value"
          options={[{value:"current",label:"Current"},{value:"incoming",label:"Incoming"}]} onChange={(value) => {
            setChosen((old) => {
              const next = new Map(old);
              if (value) next.set(choiceKey(item),value); else next.delete(choiceKey(item));
              return next;
            });
          }} />
      </>} />
    </AsyncForm>
  </ControlPanel>;
}
