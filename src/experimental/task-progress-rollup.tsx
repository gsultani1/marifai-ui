// packages/ai-ui/src/experimental/task-progress-rollup.tsx
"use client";

import { ControlAction, ControlPanel } from "../lib/component-controls.js";

export type TaskProgressGroup = "completed" | "blocked" | "remaining";
export interface TaskProgressItem { id: string; status: TaskProgressGroup }

export interface TaskProgressRollupProps {
  tasks: readonly TaskProgressItem[];
  onOpenGroup?: (group: TaskProgressGroup, ids: readonly string[]) => void;
  className?: string;
}

export function TaskProgressRollup({ tasks, onOpenGroup, className }: TaskProgressRollupProps) {
  return <ControlPanel slot="task-progress-rollup" title="Task progress" className={className}>
    <dl className="grid gap-2 text-sm sm:grid-cols-3">
      {([{id:"completed",label:"Completed"},{id:"blocked",label:"Blocked"},{id:"remaining",label:"Remaining"}] as const).map((group) => {
        const ids = tasks.filter((item) => item.status === group.id).map((item) => item.id);
        return <div key={group.id} className="space-y-1"><dt>{group.label}</dt><dd className="tabular-nums">{ids.length}</dd>
          <ControlAction label={"View " + group.id} disabled={!ids.length} onClick={onOpenGroup && (() => onOpenGroup(group.id,ids))} /></div>;
      })}
    </dl>
  </ControlPanel>;
}
