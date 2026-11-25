// packages/ai-ui/example/gallery/tasks.tsx
import { useRef, useState } from "react";

import {
  TaskActivityFeed,
  TaskAssignmentPicker,
  TaskBacklogRanker,
  TaskBulkActionBar,
  TaskChecklistTemplatePicker,
  TaskConflictReview,
  TaskDependencyEditor,
  TaskDueDatePicker,
  TaskEffortSplitEditor,
  TaskEstimateEditor,
  TaskMilestoneTimeline,
  TaskProgressRollup,
  TaskQuickAdd,
  TaskRecurrencePicker,
  TaskSubtaskList,
  TaskTimeBlockEditor,
  type RankedTask,
  type TaskActivityEntry,
  type TaskBulkAction,
  type TaskEffortItem,
  type TaskFieldConflict,
  type TaskProgressGroup,
  type TaskRecurrenceValue,
  type TaskSubtask,
  type TaskTimeBlock,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const ASSIGNEES = [
  { id: "dana", label: "Dana Reyes" },
  { id: "lee", label: "Lee Park", unavailableReason: "On leave until Dec 1" },
  { id: "agent", label: "Restock agent" },
];

const BULK_ACTIONS: TaskBulkAction[] = [
  { id: "high", label: "Set priority to High", kind: "priority" },
  { id: "low", label: "Set priority to Low", kind: "priority" },
  { id: "agent", label: "Assign to the restock agent", kind: "assignment", unavailableReason: "Agent paused for the inventory count" },
];

const TEMPLATES = [
  { id: "aisle", title: "Paint aisle reset", steps: ["Tape off the aisle", "Pull damaged cans", "Restock by color family"] },
  { id: "delivery", title: "Delivery intake", steps: ["Match the packing slip", "Check for dented cans", "Shelve the pallets"] },
];

const TIME_ZONES = ["America/Chicago", "America/Denver", "America/New_York"];

const PROJECT_TASKS = [
  { id: "count", title: "Count gallons on hand", status: "completed" },
  { id: "quote", title: "Get the supplier quote", status: "completed" },
  { id: "tint", title: "Calibrate the tint machine", status: "blocked" },
  { id: "paint", title: "Restock exterior paint", status: "remaining" },
  { id: "signs", title: "Update aisle signs", status: "remaining" },
] as const satisfies readonly { id: string; title: string; status: TaskProgressGroup }[];

const MILESTONES = [
  { id: "reset", title: "Paint aisle reset", date: "Nov 24", blockedDates: ["Nov 26"], tasks: [
    { id: "paint", title: "Restock exterior paint" },
    { id: "tint", title: "Calibrate the tint machine" },
  ] },
  { id: "winter", title: "Garden center winterizing", date: "Dec 1", tasks: [{ id: "mulch", title: "Order mulch pallets" }] },
  { id: "lights", title: "Holiday lights display", date: "Dec 5", tasks: [] },
];

const CONFLICTS: TaskFieldConflict[] = [
  { id: "title", field: "Title", current: "Restock exterior paint", incoming: "Restock exterior paint and primer" },
  { id: "due", field: "Due date", current: "Nov 24", incoming: "Nov 25" },
];

function settle() {
  return new Promise<void>((resolve) => setTimeout(resolve, 400));
}

function shortDate(date: Date | null) {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined;
}

export function TasksGallery() {
  const nextId = useRef(0);
  const [backlog, setBacklog] = useState<RankedTask[]>([
    { id: "paint", title: "Restock exterior paint", priority: "High" },
    { id: "signs", title: "Update aisle signs", priority: "Normal" },
    { id: "mulch", title: "Order mulch pallets", priority: "Low" },
    { id: "tint", title: "Calibrate the tint machine" },
  ]);
  const [selected, setSelected] = useState<string[]>(["signs", "mulch"]);
  const [assignee, setAssignee] = useState<string | null>("dana");
  const [due, setDue] = useState<Date | null>(new Date(2026, 10, 24));
  const [recurrence, setRecurrence] = useState<TaskRecurrenceValue>({ frequency: "weekly", endDate: new Date(2026, 11, 29) });
  const [estimate, setEstimate] = useState(120);
  const [timeBlock, setTimeBlock] = useState<TaskTimeBlock>({ start: "2026-11-23T07:00", end: "2026-11-23T09:00", timeZone: "America/Chicago" });
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([
    { id: "s1", title: "Pull the empty cans", complete: true },
    { id: "s2", title: "Count gallons on hand", complete: true },
    { id: "s3", title: "Order 40 gallons of satin white", complete: false },
    { id: "s4", title: "Face the shelf", complete: false },
  ]);
  const [savingSubtasks, setSavingSubtasks] = useState<string[]>([]);
  const [effort, setEffort] = useState<TaskEffortItem[]>([
    { id: "order", title: "Count and order", minutes: 30 },
    { id: "restock", title: "Restock shelves", minutes: 60 },
    { id: "face", title: "Face and label", minutes: 20 },
  ]);
  const [prerequisites, setPrerequisites] = useState<string[]>(["tint"]);
  const [savingPrerequisites, setSavingPrerequisites] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState(CONFLICTS);
  const [opened, setOpened] = useState("");
  const [activity, setActivity] = useState<TaskActivityEntry[]>([
    { id: "a1", actor: "Restock agent", timestamp: "Today, 8:02 AM", field: "status", before: "To do", after: "In progress" },
    { id: "a2", actor: "Dana Reyes", timestamp: "Today, 8:15 AM", field: "assignee", before: "Unassigned", after: "Dana Reyes" },
  ]);

  function newId(prefix: string) {
    nextId.current += 1;
    return prefix + "-" + nextId.current;
  }

  function log(field: string, before: string | undefined, after: string | undefined) {
    setActivity((current) => [...current, {
      id: "change-" + (current.length + 1), actor: "You", timestamp: "Just now", field,
      ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }),
    }]);
  }

  const assigneeName = (id: string | null) => ASSIGNEES.find((person) => person.id === id)?.label ?? "Unassigned";
  const projectTitle = (id: string) => PROJECT_TASKS.find((task) => task.id === id)?.title ?? id;

  return (
    <GallerySection id="gallery-tasks" title="Task management">
      <Demo title="Capture and prioritize" className="grid w-full items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TaskQuickAdd onAdd={async (task) => {
          await settle();
          setBacklog((current) => [...current, { id: newId("task"), title: task.title }]);
          log("backlog", undefined, task.dueDate ? task.title + " (due " + task.dueDate + ")" : task.title);
        }} />
        <TaskBacklogRanker tasks={backlog} onReorder={(ids) => {
          setBacklog((current) => ids.flatMap((id) => current.filter((task) => task.id === id)));
        }} />
        <div className="space-y-3">
          <fieldset className="min-w-0 space-y-1 rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
            <legend className="px-1 font-medium">Select backlog tasks</legend>
            {backlog.map((task) => (
              <label key={task.id} className="flex items-center gap-2 break-words">
                <input type="checkbox" checked={selected.includes(task.id)} onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSelected((current) => checked ? [...current, task.id] : current.filter((id) => id !== task.id));
                }} />
                {task.title}
              </label>
            ))}
          </fieldset>
          <TaskBulkActionBar selectedIds={selected} actions={BULK_ACTIONS} onApply={async (action, ids) => {
            await settle();
            const priority = action.id === "high" ? "High" : "Low";
            setBacklog((current) => current.map((task) => ids.includes(task.id) ? { ...task, priority } : task));
            setSelected([]);
            log("priority of " + ids.length + " tasks", undefined, priority);
          }} />
        </div>
      </Demo>

      <Demo title="Schedule and estimate" className="grid w-full items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TaskAssignmentPicker assignees={ASSIGNEES} value={assignee} onChange={(id) => {
          log("assignee", assigneeName(assignee), assigneeName(id));
          setAssignee(id);
        }} />
        <div className="min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground">
          <TaskDueDatePicker value={due} locale="en-US" onChange={(date) => {
            log("due date", shortDate(due), shortDate(date));
            setDue(date);
          }} />
        </div>
        <TaskRecurrencePicker value={recurrence} {...(due ? { startDate: due } : {})} onChange={(value) => {
          log("recurrence", recurrence.frequency, value.frequency + (value.endDate ? " until " + shortDate(value.endDate) : ""));
          setRecurrence(value);
        }} />
        <TaskEstimateEditor initialMinutes={estimate} onSubmit={async (minutes) => {
          await settle();
          log("estimate", estimate + " minutes", minutes + " minutes");
          setEstimate(minutes);
        }} />
        <TaskTimeBlockEditor initialValue={timeBlock} timeZones={TIME_ZONES} onSubmit={async (block) => {
          await settle();
          log("time block", timeBlock.start + " to " + timeBlock.end, block.start + " to " + block.end + " (" + block.timeZone + ")");
          setTimeBlock(block);
        }} />
      </Demo>

      <Demo title="Break down the work" className="grid w-full items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TaskSubtaskList subtasks={subtasks} pendingIds={savingSubtasks}
          onCompleteChange={async (id, complete) => {
            setSavingSubtasks((current) => [...current, id]);
            await settle();
            setSubtasks((current) => current.map((item) => item.id === id ? { ...item, complete } : item));
            setSavingSubtasks((current) => current.filter((item) => item !== id));
          }}
          onAdd={async (title) => {
            await settle();
            setSubtasks((current) => [...current, { id: newId("subtask"), title, complete: false }]);
          }} />
        <TaskChecklistTemplatePicker templates={TEMPLATES} onApply={async (id) => {
          await settle();
          const template = TEMPLATES.find((item) => item.id === id);
          if (!template) throw new Error("That template is no longer available.");
          setSubtasks((current) => [...current, ...template.steps.map((title) => ({ id: newId("subtask"), title, complete: false }))]);
          log("checklist", undefined, template.title);
        }} />
        <TaskEffortSplitEditor items={effort} estimateMinutes={estimate} onSubmit={async (allocations) => {
          await settle();
          setEffort((current) => current.map((item) => ({ ...item, minutes: allocations.find((entry) => entry.id === item.id)?.minutes ?? item.minutes })));
          log("effort split", undefined, allocations.map((entry) => entry.minutes).join(" + ") + " minutes");
        }} />
        <TaskDependencyEditor taskId="paint" dependencyIds={prerequisites} pendingIds={savingPrerequisites}
          options={[
            ...backlog.map((task) => task.id === "signs" ? { id: task.id, title: task.title, unavailableReason: "Already waits on this task" } : { id: task.id, title: task.title }),
            { id: "quote", title: "Get the supplier quote" },
          ]}
          onAdd={async (id) => {
            setSavingPrerequisites((current) => [...current, id]);
            await settle();
            setPrerequisites((current) => [...current, id]);
            setSavingPrerequisites((current) => current.filter((item) => item !== id));
          }}
          onRemove={async (id) => {
            setSavingPrerequisites((current) => [...current, id]);
            await settle();
            setPrerequisites((current) => current.filter((item) => item !== id));
            setSavingPrerequisites((current) => current.filter((item) => item !== id));
          }} />
      </Demo>

      <Demo title="Track progress" className="grid w-full items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <TaskProgressRollup tasks={PROJECT_TASKS} onOpenGroup={(group, ids) => {
            setOpened("Showing " + group + " tasks: " + ids.map(projectTitle).join(", ") + ".");
          }} />
          <TaskMilestoneTimeline milestones={MILESTONES} onOpenTask={(id) => {
            setOpened("Opened " + (MILESTONES.flatMap((milestone) => milestone.tasks).find((task) => task.id === id)?.title ?? id) + ".");
          }} />
          <p role="status" className="text-sm text-muted-foreground">{opened}</p>
        </div>
        <TaskConflictReview conflicts={conflicts} onSubmit={async (decisions) => {
          await settle();
          for (const decision of decisions) {
            const conflict = conflicts.find((item) => item.id === decision.id);
            if (conflict && decision.side === "incoming") log(conflict.field.toLowerCase(), conflict.current, conflict.incoming);
          }
          setConflicts([]);
        }} />
        <TaskActivityFeed entries={activity} />
      </Demo>
    </GallerySection>
  );
}
