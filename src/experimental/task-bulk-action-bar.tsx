// packages/ai-ui/src/experimental/task-bulk-action-bar.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface TaskBulkAction { id: string; label: string; kind: "status" | "priority" | "assignment"; unavailableReason?: string }

export interface TaskBulkActionBarProps {
  selectedIds: readonly string[];
  actions: readonly TaskBulkAction[];
  onApply: (action: TaskBulkAction, ids: readonly string[]) => void | Promise<void>;
  className?: string;
}

export function TaskBulkActionBar({ selectedIds, actions, onApply, className }: TaskBulkActionBarProps) {
  const [actionId, setAction] = useState("");
  const selected = actions.find((item) => item.id === actionId);
  return <ControlPanel slot="task-bulk-action-bar" title="Bulk task actions" className={className}>
    <p role="status" className="text-sm">{selectedIds.length} selected</p>
    <AsyncForm label="Bulk task action" submitLabel="Apply to selected" disabled={!selectedIds.length || !selected || Boolean(selected.unavailableReason)}
      onSubmit={() => { if (selected) return onApply(selected, [...new Set(selectedIds)]); }}>
      <ChoiceField label="Bulk action" value={selected?.id ?? ""} placeholder="Choose an action"
        options={actions.map((item) => ({ value: item.id, label: item.label + (item.unavailableReason ? " · " + item.unavailableReason : ""), disabled: Boolean(item.unavailableReason) }))} onChange={setAction} />
    </AsyncForm>
  </ControlPanel>;
}
