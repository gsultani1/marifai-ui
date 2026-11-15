// packages/ai-ui/src/components/task-inbox.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface InboxTask { id: string; title: string; status: string; priority: string; detail?: string }

export interface TaskInboxProps {
  tasks: readonly InboxTask[];
  onOpen: (id: string) => void;
  className?: string;
}

export function TaskInbox({ tasks, onOpen, className }: TaskInboxProps) {
  const [priority, setPriority] = useState("");
  const priorities = [...new Set(tasks.map((task) => task.priority))];
  const visible = priorities.includes(priority) ? tasks.filter((task) => task.priority === priority) : tasks;
  return <ControlPanel slot="task-inbox" title="Task inbox" className={className}>
    <ChoiceField label="Priority" value={priorities.includes(priority) ? priority : ""} placeholder="All priorities"
      options={priorities.map((value) => ({ value, label: value }))} onChange={setPriority} />
    <FilteredList items={visible} searchLabel="Search tasks" searchText={(task) => [task.title, task.detail]}
      filterLabel="Status" filters={[...new Set(tasks.map((task) => task.status))].map((value) => ({ value, label: value }))}
      category={(task) => task.status} empty="No matching tasks." render={(task) => <ItemHeading title={task.title}
        detail={[task.status, task.priority, task.detail].filter(Boolean).join(" · ")}>
        <ControlAction label="Open task" item={task.title} onClick={() => onOpen(task.id)} />
      </ItemHeading>} />
  </ControlPanel>;
}
