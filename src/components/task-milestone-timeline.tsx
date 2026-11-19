// packages/ai-ui/src/components/task-milestone-timeline.tsx
"use client";

import { ControlAction, ControlPanel } from "../lib/component-controls.js";

export interface TaskMilestone {
  id: string; title: string; date: string; blockedDates?: readonly string[];
  tasks: readonly {id: string; title: string}[];
}

export interface TaskMilestoneTimelineProps {
  /** Milestones in chronological display order. */
  milestones: readonly TaskMilestone[];
  onOpenTask?: (id: string) => void;
  className?: string;
}

export function TaskMilestoneTimeline({ milestones, onOpenTask, className }: TaskMilestoneTimelineProps) {
  return <ControlPanel slot="task-milestone-timeline" title="Milestones" className={className}>
    {milestones.length ? <ol className="space-y-3 border-s border-border ps-3">{milestones.map((item) => <li key={item.id} className="space-y-1">
      <h4 className="text-sm font-medium break-words">{item.title} · {item.date}</h4>
      {item.blockedDates?.length ? <p className="text-sm text-muted-foreground">Blocked dates · {item.blockedDates.join(", ")}</p> : null}
      <ul className="space-y-1 text-sm">{item.tasks.map((task) => <li key={task.id}>
        <ControlAction label="Open task" item={task.title} onClick={onOpenTask && (() => onOpenTask(task.id))} /> {task.title}
      </li>)}</ul>
    </li>)}</ol> : <p className="text-sm text-muted-foreground">No milestones.</p>}
  </ControlPanel>;
}
