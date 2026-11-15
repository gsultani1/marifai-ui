// packages/ai-ui/src/components/task-assignment-picker.tsx
"use client";

import { ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface TaskAssignee { id: string; label: string; unavailableReason?: string }

export interface TaskAssignmentPickerProps {
  assignees: readonly TaskAssignee[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}

export function TaskAssignmentPicker({ assignees, value, onChange, className }: TaskAssignmentPickerProps) {
  return <ControlPanel slot="task-assignment-picker" title="Task assignment" className={className}>
    <ChoiceField label="Assignee" value={value && assignees.some((item) => item.id === value) ? value : ""} placeholder="Unassigned"
      options={assignees.map((item) => ({value:item.id,label:[item.label,item.unavailableReason].filter(Boolean).join(" · "),disabled:Boolean(item.unavailableReason)}))}
      onChange={(id) => onChange(id || null)} />
  </ControlPanel>;
}
