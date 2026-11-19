// packages/ai-ui/src/components/task-subtask-list.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass, ItemList } from "../lib/component-controls.js";

export interface TaskSubtask { id: string; title: string; complete: boolean }

export interface TaskSubtaskListProps {
  subtasks: readonly TaskSubtask[];
  onAdd?: (title: string) => void | Promise<void>;
  onCompleteChange?: (id: string, complete: boolean) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function TaskSubtaskList({ subtasks, onAdd, onCompleteChange, pendingIds = [], className }: TaskSubtaskListProps) {
  const [title, setTitle] = useState("");
  const completed = subtasks.filter((item) => item.complete).length;
  return <ControlPanel slot="task-subtask-list" title="Subtasks" className={className}>
    <p role="status" className="text-sm">{completed} of {subtasks.length} complete</p>
    {subtasks.length > 0 && <progress aria-label="Subtask progress" className="w-full accent-primary" value={completed} max={subtasks.length} />}
    <ItemList items={subtasks} empty="No subtasks." render={(item) => onCompleteChange
      ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.complete} disabled={pendingIds.includes(item.id)}
        onChange={(event) => onCompleteChange(item.id, event.currentTarget.checked)} />{item.title}</label>
      : <p className="text-sm">{item.title} · {item.complete ? "Complete" : "Open"}</p>} />
    {onAdd && <AsyncForm label="Add subtask" submitLabel="Add subtask" disabled={!title.trim()}
      onSubmit={async () => { await onAdd(title.trim()); setTitle(""); }}>
      <Field label="Subtask name"><input className={fieldClass} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
    </AsyncForm>}
  </ControlPanel>;
}
