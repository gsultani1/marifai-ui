// packages/ai-ui/src/experimental/task-effort-split-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass, requiredNumber } from "../lib/component-controls.js";

export interface TaskEffortItem { id: string; title: string; minutes: number }
export interface TaskEffortAllocation { id: string; minutes: number }

export interface TaskEffortSplitEditorProps {
  items: readonly TaskEffortItem[];
  estimateMinutes: number;
  onSubmit: (allocations: TaskEffortAllocation[]) => void | Promise<void>;
  className?: string;
}

export function TaskEffortSplitEditor({ items, estimateMinutes, onSubmit, className }: TaskEffortSplitEditorProps) {
  const [changes,setChanges] = useState(() => new Map<string,string>());
  const total = items.reduce((sum,item) => {
    const value = Number(changes.get(item.id) ?? item.minutes);
    return Number.isFinite(value) && value >= 0 ? sum + value : sum;
  },0);
  return <ControlPanel slot="task-effort-split-editor" title="Task effort allocation" className={className}>
    <p role="status" className="text-sm">{total} of {estimateMinutes} estimated minutes</p>
    <AsyncForm label="Task effort allocation" submitLabel="Save allocation" disabled={!items.length}
      onSubmit={() => onSubmit(items.map((item) => ({id:item.id,minutes:requiredNumber(changes.get(item.id) ?? String(item.minutes),item.title,0,true)})))}>
      {items.map((item) => <Field key={item.id} label={item.title + " minutes"}><input className={fieldClass} inputMode="numeric"
        value={changes.get(item.id) ?? String(item.minutes)} onChange={(event) => {
          const value=event.currentTarget.value; setChanges((old) => new Map(old).set(item.id,value));
        }} /></Field>)}
    </AsyncForm>
  </ControlPanel>;
}
