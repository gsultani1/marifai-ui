// packages/ai-ui/src/components/task-backlog-ranker.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { OrderedList } from "../lib/collection-controls.js";
export interface RankedTask { id: string; title: string; priority?: string }

export interface TaskBacklogRankerProps {
  tasks: readonly RankedTask[];
  onReorder: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function TaskBacklogRanker({ tasks, onReorder, disabled, className }: TaskBacklogRankerProps) {
  return <ControlPanel slot="task-backlog-ranker" title="Task backlog" className={className}>
    <OrderedList items={tasks} label="Prioritized tasks" itemLabel={(item) => item.title} onReorder={onReorder} disabled={disabled}
      render={(item) => item.title + (item.priority ? " · " + item.priority : "")} />
  </ControlPanel>;
}
