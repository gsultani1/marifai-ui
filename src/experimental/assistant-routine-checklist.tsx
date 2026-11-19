// packages/ai-ui/src/experimental/assistant-routine-checklist.tsx
"use client";

import { ControlPanel, ItemList } from "../lib/component-controls.js";

export interface RoutineChecklistStep { id: string; title: string; checked: boolean }

export interface AssistantRoutineChecklistProps {
  occurrenceId: string;
  occurrenceLabel: string;
  steps: readonly RoutineChecklistStep[];
  onChange: (occurrenceId: string, stepId: string, checked: boolean) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function AssistantRoutineChecklist({ occurrenceId, occurrenceLabel, steps, onChange, pendingIds = [], className }: AssistantRoutineChecklistProps) {
  return <ControlPanel slot="assistant-routine-checklist" title="Routine checklist" className={className}>
    <p className="text-sm">{occurrenceLabel}</p>
    <p role="status" className="text-sm text-muted-foreground">{steps.filter((step) => step.checked).length} of {steps.length} done</p>
    <ItemList items={steps} empty="No routine steps." render={(step) => <label className="text-sm break-words">
      <input type="checkbox" checked={step.checked} disabled={pendingIds.includes(step.id)}
        onChange={(event) => onChange(occurrenceId, step.id, event.currentTarget.checked)} /> {step.title}
    </label>} />
  </ControlPanel>;
}
