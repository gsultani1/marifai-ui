// packages/ai-ui/src/experimental/task-dependency-editor.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface TaskPrerequisite { id: string; title: string; unavailableReason?: string }

export interface TaskDependencyEditorProps {
  taskId?: string;
  options: readonly TaskPrerequisite[];
  dependencyIds: readonly string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  error?: string;
  pendingIds?: readonly string[];
  className?: string;
}

export function TaskDependencyEditor({ taskId, options, dependencyIds, onAdd, onRemove, error, pendingIds = [], className }: TaskDependencyEditorProps) {
  const [choice, setChoice] = useState("");
  const available = options.filter((item) => item.id !== taskId && !dependencyIds.includes(item.id));
  const selected = available.find((item) => item.id === choice);
  return <ControlPanel slot="task-dependency-editor" title="Task prerequisites" className={className}>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <ChoiceField label="Prerequisite" value={selected?.id ?? ""} placeholder="Choose a task" onChange={setChoice}
      options={available.map((item) => ({ value: item.id, label: item.unavailableReason ? item.title + " · " + item.unavailableReason : item.title, disabled: Boolean(item.unavailableReason) }))} />
    <ControlAction label="Add prerequisite" disabled={!selected || Boolean(selected.unavailableReason) || pendingIds.includes(choice)}
      onClick={() => { if (selected && !selected.unavailableReason) onAdd(selected.id); }} />
    <ItemList items={dependencyIds.map((id) => ({ id, title: options.find((item) => item.id === id)?.title ?? id }))}
      empty="No prerequisites." render={(item) => <ItemHeading title={item.title}>
        <ControlAction label="Remove prerequisite" item={item.title} disabled={pendingIds.includes(item.id)} onClick={() => onRemove(item.id)} />
      </ItemHeading>} />
  </ControlPanel>;
}
