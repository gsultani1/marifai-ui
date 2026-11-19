// packages/ai-ui/src/experimental/task-activity-feed.tsx
"use client";

import { ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface TaskActivityEntry { id: string; actor: string; timestamp: string; field: string; before?: string; after?: string }

export interface TaskActivityFeedProps {
  /** Entries in chronological display order. */
  entries: readonly TaskActivityEntry[];
  className?: string;
}

export function TaskActivityFeed({ entries, className }: TaskActivityFeedProps) {
  return <ControlPanel slot="task-activity-feed" title="Task activity" className={className}>
    <ItemList items={entries} empty="No task activity." render={(item) => <>
      <ItemHeading title={item.actor + " changed " + item.field} detail={item.timestamp} />
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Before</dt><dd className="break-words">{item.before ?? "Unset"}</dd></div>
        <div><dt className="text-muted-foreground">After</dt><dd className="break-words">{item.after ?? "Unset"}</dd></div>
      </dl>
    </>} />
  </ControlPanel>;
}
