// packages/ai-ui/test/tasks.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  type TaskBulkAction,
  type TaskFieldConflict,
} from "../src/index.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function select(name: string) {
  return screen.getByRole("combobox", { name }) as HTMLSelectElement;
}

function optionLabels(element: HTMLSelectElement) {
  return [...element.options].map((option) => option.textContent);
}

async function submit(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("TaskActivityFeed", () => {
  it("lists each change with its actor, field, time and before and after values", () => {
    render(<TaskActivityFeed entries={[
      { id: "1", actor: "Dana Reyes", timestamp: "Today, 9:14 AM", field: "status", before: "To do", after: "In progress" },
      { id: "2", actor: "Restock agent", timestamp: "Today, 9:20 AM", field: "due date", after: "Nov 21" },
    ]} />);
    const panel = screen.getByRole("region", { name: "Task activity" });
    const items = within(panel).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Dana Reyes changed status")).toBeTruthy();
    expect(within(items[0]!).getByText("Today, 9:14 AM")).toBeTruthy();
    expect(within(items[0]!).getAllByRole("term").map((term) => term.textContent)).toEqual(["Before", "After"]);
    expect(within(items[0]!).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["To do", "In progress"]);
    expect(within(items[1]!).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["Unset", "Nov 21"]);
  });

  it("says when there is no activity", () => {
    render(<TaskActivityFeed entries={[]} />);
    expect(screen.getByText("No task activity.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("TaskAssignmentPicker", () => {
  const assignees = [
    { id: "dana", label: "Dana Reyes" },
    { id: "lee", label: "Lee Park", unavailableReason: "On leave" },
    { id: "agent", label: "Restock agent" },
  ];

  it("assigns a person, names unavailable people with the reason and disables them", () => {
    const onChange = vi.fn();
    render(<TaskAssignmentPicker assignees={assignees} value={null} onChange={onChange} />);
    const picker = select("Assignee");
    expect(picker.value).toBe("");
    expect(optionLabels(picker)).toEqual(["Unassigned", "Dana Reyes", "Lee Park · On leave", "Restock agent"]);
    expect(picker.options[2]!.disabled).toBe(true);
    fireEvent.change(picker, { target: { value: "agent" } });
    expect(onChange).toHaveBeenLastCalledWith("agent");
    fireEvent.change(picker, { target: { value: "lee" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("unassigns with null and shows Unassigned for an unknown value", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TaskAssignmentPicker assignees={assignees} value="dana" onChange={onChange} />);
    expect(select("Assignee").value).toBe("dana");
    fireEvent.change(select("Assignee"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    rerender(<TaskAssignmentPicker assignees={assignees} value="removed-user" onChange={onChange} />);
    expect(select("Assignee").value).toBe("");
  });
});

describe("TaskBacklogRanker", () => {
  const tasks = [
    { id: "paint", title: "Restock exterior paint", priority: "High" },
    { id: "signs", title: "Update aisle signs" },
    { id: "mulch", title: "Order mulch pallets", priority: "Low" },
  ];

  it("shows priority in text and reports the new order of ids after a keyboard move", () => {
    const onReorder = vi.fn();
    render(<TaskBacklogRanker tasks={tasks} onReorder={onReorder} />);
    const list = screen.getByRole("list", { name: "Prioritized tasks" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Restock exterior paint · High", "Update aisle signs", "Order mulch pallets · Low",
    ]);
    const handle = screen.getByRole("button", { name: "Reorder Restock exterior paint" });
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Restock exterior paint" }), { key: "Enter" });
    expect(onReorder).toHaveBeenCalledWith(["signs", "paint", "mulch"]);
  });

  it("disables reordering while disabled and says when the backlog is empty", () => {
    const onReorder = vi.fn();
    const { rerender } = render(<TaskBacklogRanker tasks={tasks} onReorder={onReorder} disabled />);
    const handle = screen.getByRole("button", { name: "Reorder Update aisle signs" }) as HTMLButtonElement;
    expect(handle.disabled).toBe(true);
    fireEvent.keyDown(handle, { key: " " });
    expect(onReorder).not.toHaveBeenCalled();
    rerender(<TaskBacklogRanker tasks={[]} onReorder={onReorder} />);
    expect(screen.getByText("No items to order.")).toBeTruthy();
  });
});

describe("TaskBulkActionBar", () => {
  const actions: TaskBulkAction[] = [
    { id: "done", label: "Mark done", kind: "status" },
    { id: "urgent", label: "Set priority to urgent", kind: "priority" },
    { id: "assign-lee", label: "Assign to Lee", kind: "assignment", unavailableReason: "Lee is on leave" },
  ];

  it("applies the chosen action once to the unique selected ids and then clears the action", async () => {
    const onApply = vi.fn();
    render(<TaskBulkActionBar selectedIds={["t1", "t2", "t1"]} actions={actions} onApply={onApply} />);
    expect(screen.getByRole("status").textContent).toBe("2 selected");
    fireEvent.change(select("Bulk action"), { target: { value: "done" } });
    await submit("Apply to selected");
    expect(onApply).toHaveBeenCalledWith(actions[0], ["t1", "t2"]);
    expect(select("Bulk action").value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks for a selection and an action instead of applying, and keeps unavailable actions disabled", async () => {
    const onApply = vi.fn();
    const { rerender } = render(<TaskBulkActionBar selectedIds={[]} actions={actions} onApply={onApply} />);
    expect(screen.getByRole("status").textContent).toBe("0 selected");
    fireEvent.change(select("Bulk action"), { target: { value: "urgent" } });
    await submit("Apply to selected");
    expect(screen.getByRole("alert").textContent).toBe("Select at least one task.");
    rerender(<TaskBulkActionBar selectedIds={["t3"]} actions={actions} onApply={onApply} />);
    fireEvent.change(select("Bulk action"), { target: { value: "" } });
    await submit("Apply to selected");
    expect(screen.getByRole("alert").textContent).toBe("Choose an action.");
    expect(optionLabels(select("Bulk action"))).toContain("Assign to Lee · Lee is on leave");
    fireEvent.change(select("Bulk action"), { target: { value: "assign-lee" } });
    expect(select("Bulk action").value).toBe("");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("blocks a second apply while the first is pending and keeps the action when applying fails", async () => {
    const pending = deferred();
    const onApply = vi.fn().mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error("3 tasks are locked."));
    render(<TaskBulkActionBar selectedIds={["t1"]} actions={actions} onApply={onApply} />);
    fireEvent.change(select("Bulk action"), { target: { value: "urgent" } });
    await submit("Apply to selected");
    const button = screen.getByRole("button", { name: "Apply to selected" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    await submit("Apply to selected");
    expect(onApply).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    fireEvent.change(select("Bulk action"), { target: { value: "urgent" } });
    await submit("Apply to selected");
    expect(screen.getByRole("alert").textContent).toBe("3 tasks are locked.");
    expect(select("Bulk action").value).toBe("urgent");
  });

  it("disables applying when there are no actions", () => {
    render(<TaskBulkActionBar selectedIds={["t1"]} actions={[]} onApply={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Apply to selected" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("TaskChecklistTemplatePicker", () => {
  const templates = [
    { id: "open", title: "Store opening", steps: ["Count the register", "Unlock the garden gate", "Check the paint shaker"] },
    { id: "delivery", title: "Delivery intake", steps: ["Match the packing slip", "Shelve the pallets"] },
  ];

  it("previews the steps, applies the template, announces it and clears the choice", async () => {
    const onApply = vi.fn();
    render(<TaskChecklistTemplatePicker templates={templates} onApply={onApply} />);
    fireEvent.change(select("Template"), { target: { value: "open" } });
    const steps = screen.getByRole("list", { name: "Store opening steps" });
    expect(steps.tagName).toBe("OL");
    expect(within(steps).getAllByRole("listitem").map((step) => step.textContent)).toEqual(templates[0]!.steps);
    await submit("Apply checklist");
    expect(onApply).toHaveBeenCalledWith("open");
    expect(screen.getByRole("status").textContent).toBe("Applied the Store opening checklist.");
    expect(select("Template").value).toBe("");
    expect(screen.queryByRole("list")).toBeNull();
    fireEvent.change(select("Template"), { target: { value: "delivery" } });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("asks for a template before applying and keeps the choice when applying fails", async () => {
    const onApply = vi.fn().mockRejectedValue(new Error("This task already has a checklist."));
    render(<TaskChecklistTemplatePicker templates={templates} onApply={onApply} />);
    await submit("Apply checklist");
    expect(screen.getByRole("alert").textContent).toBe("Choose a template.");
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(select("Template"), { target: { value: "delivery" } });
    await submit("Apply checklist");
    expect(screen.getByRole("alert").textContent).toBe("This task already has a checklist.");
    expect(select("Template").value).toBe("delivery");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("says when there are no templates", () => {
    render(<TaskChecklistTemplatePicker templates={[]} onApply={vi.fn()} />);
    expect(screen.getByText("No checklist templates.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("TaskConflictReview", () => {
  const conflicts: TaskFieldConflict[] = [
    { id: "title", field: "Title", current: "Restock paint", incoming: "Restock exterior paint" },
    { id: "due", field: "Due date", current: "Nov 21", incoming: "Nov 24" },
  ];

  it("labels each field's current and incoming values and submits one decision per field", async () => {
    const onSubmit = vi.fn();
    render(<TaskConflictReview conflicts={conflicts} onSubmit={onSubmit} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByRole("heading", { name: "Title" })).toBeTruthy();
    expect(within(items[0]!).getAllByRole("term").map((term) => term.textContent)).toEqual(["Current", "Incoming"]);
    expect(within(items[0]!).getAllByRole("definition").map((value) => value.textContent)).toEqual(["Restock paint", "Restock exterior paint"]);
    fireEvent.change(select("Value for Title"), { target: { value: "incoming" } });
    await submit("Apply resolutions");
    expect(screen.getByRole("alert").textContent).toBe("Choose a value for every field.");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(select("Value for Due date"), { target: { value: "current" } });
    await submit("Apply resolutions");
    expect(onSubmit).toHaveBeenCalledWith([{ id: "title", side: "incoming" }, { id: "due", side: "current" }]);
  });

  it("drops a choice when that field's values change", () => {
    const { rerender } = render(<TaskConflictReview conflicts={conflicts} onSubmit={vi.fn()} />);
    fireEvent.change(select("Value for Due date"), { target: { value: "incoming" } });
    fireEvent.change(select("Value for Title"), { target: { value: "current" } });
    rerender(<TaskConflictReview conflicts={[conflicts[0]!, { ...conflicts[1]!, incoming: "Nov 28" }]} onSubmit={vi.fn()} />);
    expect(select("Value for Due date").value).toBe("");
    expect(select("Value for Title").value).toBe("current");
  });

  it("surfaces a failed submit", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("The task changed again."));
    render(<TaskConflictReview conflicts={[conflicts[0]!]} onSubmit={onSubmit} />);
    fireEvent.change(select("Value for Title"), { target: { value: "current" } });
    await submit("Apply resolutions");
    expect(screen.getByRole("alert").textContent).toBe("The task changed again.");
  });

  it("says when there are no conflicts and disables applying", () => {
    render(<TaskConflictReview conflicts={[]} onSubmit={vi.fn()} />);
    expect(screen.getByText("No conflicting fields.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Apply resolutions" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("TaskDependencyEditor", () => {
  const options = [
    { id: "t1", title: "Restock exterior paint" },
    { id: "t2", title: "Order tint base" },
    { id: "t3", title: "Print shelf labels", unavailableReason: "Would create a cycle" },
    { id: "t4", title: "Clean the paint counter" },
  ];

  it("offers other tasks only, adds the chosen one and clears the choice", () => {
    const onAdd = vi.fn();
    render(<TaskDependencyEditor taskId="t1" options={options} dependencyIds={["t4"]} onAdd={onAdd} onRemove={vi.fn()} />);
    expect(optionLabels(select("Prerequisite"))).toEqual(["Choose a task", "Order tint base", "Print shelf labels · Would create a cycle"]);
    const add = screen.getByRole("button", { name: "Add prerequisite" });
    expect(add.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(add);
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(select("Prerequisite"), { target: { value: "t3" } });
    expect(select("Prerequisite").value).toBe("");
    fireEvent.change(select("Prerequisite"), { target: { value: "t2" } });
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith("t2");
    expect(select("Prerequisite").value).toBe("");
    expect((add as HTMLButtonElement).disabled).toBe(false);
    expect(add.getAttribute("aria-disabled")).toBe("true");
  });

  it("does not preselect a prerequisite again after it is removed", () => {
    const onRemove = vi.fn();
    const { rerender } = render(<TaskDependencyEditor taskId="t1" options={options} dependencyIds={[]} onAdd={vi.fn()} onRemove={onRemove} />);
    fireEvent.change(select("Prerequisite"), { target: { value: "t2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add prerequisite" }));
    rerender(<TaskDependencyEditor taskId="t1" options={options} dependencyIds={["t2"]} onAdd={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove prerequisite Order tint base" }));
    expect(onRemove).toHaveBeenCalledWith("t2");
    rerender(<TaskDependencyEditor taskId="t1" options={options} dependencyIds={[]} onAdd={vi.fn()} onRemove={onRemove} />);
    expect(select("Prerequisite").value).toBe("");
  });

  it("blocks pending prerequisites, shows the error and lists unknown or duplicate ids once", () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<TaskDependencyEditor taskId="t1" options={options} dependencyIds={["t4", "t4", "legacy-9"]} pendingIds={["t4", "t2"]}
      error="Couldn't save the prerequisite." onAdd={onAdd} onRemove={onRemove} />);
    expect(screen.getByRole("alert").textContent).toBe("Couldn't save the prerequisite.");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Remove prerequisite Clean the paint counter" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove prerequisite legacy-9" })).toBeTruthy();
    const remove = screen.getByRole("button", { name: "Remove prerequisite Clean the paint counter" }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    fireEvent.click(remove);
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.change(select("Prerequisite"), { target: { value: "t2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add prerequisite" }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("says when there are no prerequisites", () => {
    render(<TaskDependencyEditor options={options} dependencyIds={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("No prerequisites.")).toBeTruthy();
  });
});

describe("TaskDueDatePicker", () => {
  it("labels the picker Due date, picks a day and clears it", async () => {
    const onChange = vi.fn();
    const { container } = render(<TaskDueDatePicker value={new Date(2026, 10, 19)} onChange={onChange} locale="en-US" className="w-full" />);
    expect(container.querySelector("[data-slot='task-due-date-picker']")?.className).toContain("w-full");
    fireEvent.click(screen.getByRole("button", { name: "Due date Nov 19, 2026" }));
    fireEvent.click(await screen.findByRole("button", { name: "Friday, November 20, 2026" }));
    expect(onChange.mock.lastCall?.[0]).toEqual(new Date(2026, 10, 20));
    fireEvent.click(screen.getByRole("button", { name: "Clear Due date" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("accepts a custom label, an empty value and a disabled state", () => {
    render(<TaskDueDatePicker label="Ship by" value={null} onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: "Ship by Pick a date" }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Clear Ship by" })).toBeNull();
  });
});

describe("TaskEffortSplitEditor", () => {
  const items = [
    { id: "prep", title: "Prep the wall", minutes: 60 },
    { id: "paint", title: "Paint two coats", minutes: 90 },
  ];

  it("totals the split as it is edited and saves whole minutes per item", async () => {
    const onSubmit = vi.fn();
    render(<TaskEffortSplitEditor items={items} estimateMinutes={180} onSubmit={onSubmit} />);
    expect(screen.getByRole("status").textContent).toBe("150 of 180 estimated minutes");
    fireEvent.change(screen.getByRole("textbox", { name: "Paint two coats minutes" }), { target: { value: "120" } });
    expect(screen.getByRole("status").textContent).toBe("180 of 180 estimated minutes");
    await submit("Save allocation");
    expect(onSubmit).toHaveBeenCalledWith([{ id: "prep", minutes: 60 }, { id: "paint", minutes: 120 }]);
  });

  it("rejects fractional or blank minutes and surfaces a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("The estimate was changed by Dana."));
    render(<TaskEffortSplitEditor items={items} estimateMinutes={180} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Prep the wall minutes" }), { target: { value: "12.5" } });
    await submit("Save allocation");
    expect(screen.getByRole("alert").textContent).toBe("Prep the wall must be a whole number of at least 0.");
    fireEvent.change(screen.getByRole("textbox", { name: "Prep the wall minutes" }), { target: { value: "" } });
    await submit("Save allocation");
    expect(screen.getByRole("alert").textContent).toBe("Prep the wall is required.");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Prep the wall minutes" }), { target: { value: "30" } });
    await submit("Save allocation");
    expect(screen.getByRole("alert").textContent).toBe("The estimate was changed by Dana.");
  });

  it("disables saving when there is nothing to split", () => {
    render(<TaskEffortSplitEditor items={[]} estimateMinutes={60} onSubmit={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("0 of 60 estimated minutes");
    expect((screen.getByRole("button", { name: "Save allocation" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("TaskEstimateEditor", () => {
  it("saves minutes as entered and converts hours to whole minutes", async () => {
    const onSubmit = vi.fn();
    render(<TaskEstimateEditor initialMinutes={45} onSubmit={onSubmit} />);
    expect((screen.getByRole("textbox", { name: "Duration" }) as HTMLInputElement).value).toBe("45");
    await submit("Save estimate");
    expect(onSubmit).toHaveBeenLastCalledWith(45);
    fireEvent.change(screen.getByRole("textbox", { name: "Duration" }), { target: { value: "1.5" } });
    fireEvent.change(select("Unit"), { target: { value: "hours" } });
    await submit("Save estimate");
    expect(onSubmit).toHaveBeenLastCalledWith(90);
    fireEvent.change(screen.getByRole("textbox", { name: "Duration" }), { target: { value: "0.33" } });
    await submit("Save estimate");
    expect(onSubmit).toHaveBeenLastCalledWith(20);
  });

  it("names the Duration field in validation errors and surfaces a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Estimates are locked for this sprint."));
    render(<TaskEstimateEditor onSubmit={onSubmit} />);
    await submit("Save estimate");
    expect(screen.getByRole("alert").textContent).toBe("Duration is required.");
    fireEvent.change(screen.getByRole("textbox", { name: "Duration" }), { target: { value: "2.5" } });
    await submit("Save estimate");
    expect(screen.getByRole("alert").textContent).toBe("Duration must be a whole number of at least 0.");
    fireEvent.change(screen.getByRole("textbox", { name: "Duration" }), { target: { value: "-1" } });
    fireEvent.change(select("Unit"), { target: { value: "hours" } });
    await submit("Save estimate");
    expect(screen.getByRole("alert").textContent).toBe("Duration must be a number of at least 0.");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Duration" }), { target: { value: "2" } });
    await submit("Save estimate");
    expect(onSubmit).toHaveBeenCalledWith(120);
    expect(screen.getByRole("alert").textContent).toBe("Estimates are locked for this sprint.");
  });
});

describe("TaskMilestoneTimeline", () => {
  const milestones = [
    { id: "m1", title: "Garden center open", date: "Mar 2", blockedDates: ["Feb 27", "Feb 28"], tasks: [
      { id: "t1", title: "Stock seed racks" },
      { id: "t2", title: "Set up the cash wrap" },
    ] },
    { id: "m2", title: "Spring sale", date: "Mar 16", tasks: [] },
  ];

  it("lists milestones in order with dates, blocked dates and a named open action per task", () => {
    const onOpenTask = vi.fn();
    render(<TaskMilestoneTimeline milestones={milestones} onOpenTask={onOpenTask} />);
    const timeline = screen.getByRole("region", { name: "Milestones" }).querySelector("ol")!;
    const entries = within(timeline).getAllByRole("listitem").filter((item) => item.parentElement === timeline);
    expect(entries).toHaveLength(2);
    expect(within(entries[0]!).getByRole("heading", { name: "Garden center open · Mar 2" })).toBeTruthy();
    expect(within(entries[0]!).getByText("Blocked dates · Feb 27, Feb 28")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open task Set up the cash wrap" }));
    expect(onOpenTask).toHaveBeenCalledWith("t2");
    expect(within(entries[1]!).getByText("No tasks in this milestone.")).toBeTruthy();
  });

  it("shows task titles without buttons when tasks cannot be opened, and says when there are no milestones", () => {
    const { rerender } = render(<TaskMilestoneTimeline milestones={milestones} />);
    expect(screen.getByText("Stock seed racks")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<TaskMilestoneTimeline milestones={[]} />);
    expect(screen.getByText("No milestones.")).toBeTruthy();
  });
});

describe("TaskProgressRollup", () => {
  const tasks = [
    { id: "a", status: "completed" as const },
    { id: "b", status: "completed" as const },
    { id: "c", status: "remaining" as const },
  ];

  it("counts tasks per group and opens a group with its ids", () => {
    const onOpenGroup = vi.fn();
    render(<TaskProgressRollup tasks={tasks} onOpenGroup={onOpenGroup} />);
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Completed", "Blocked", "Remaining"]);
    expect(screen.getAllByRole("definition").map((value) => value.querySelector(".tabular-nums")?.textContent)).toEqual(["2", "0", "1"]);
    fireEvent.click(screen.getByRole("button", { name: "View completed" }));
    expect(onOpenGroup).toHaveBeenCalledWith("completed", ["a", "b"]);
    const blocked = screen.getByRole("button", { name: "View blocked" }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    fireEvent.click(blocked);
    expect(onOpenGroup).toHaveBeenCalledTimes(1);
  });

  it("keeps the definition list valid by placing each action inside its definition", () => {
    const { container } = render(<TaskProgressRollup tasks={tasks} onOpenGroup={vi.fn()} />);
    for (const group of container.querySelectorAll("dl > div")) {
      expect([...group.children].map((child) => child.tagName)).toEqual(["DT", "DD"]);
    }
  });

  it("shows counts without actions when no handler is given, including all zeros", () => {
    render(<TaskProgressRollup tasks={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["0", "0", "0"]);
  });
});

describe("TaskQuickAdd", () => {
  it("adds a trimmed title with its due date, clears the draft, announces it and returns focus to the title", async () => {
    const onAdd = vi.fn();
    render(<TaskQuickAdd onAdd={onAdd} />);
    const form = screen.getByRole("form", { name: "Add a task" });
    const title = screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
    const due = screen.getByLabelText("Due date (optional)") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "  Reorder deck screws  " } });
    fireEvent.change(due, { target: { value: "2026-11-24" } });
    await submit("Add task");
    expect(onAdd).toHaveBeenCalledWith({ title: "Reorder deck screws", dueDate: "2026-11-24" });
    expect(title.value).toBe("");
    expect(due.value).toBe("");
    expect(within(form).getByRole("status").textContent).toBe("Task added.");
    expect(document.activeElement).toBe(title);
  });

  it("leaves out an unset due date and ignores a blank title", async () => {
    const onAdd = vi.fn();
    render(<TaskQuickAdd onAdd={onAdd} />);
    const button = screen.getByRole("button", { name: "Add task" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), { target: { value: "   " } });
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Add a task" })); });
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), { target: { value: "Sweep aisle 4" } });
    await submit("Add task");
    expect(onAdd).toHaveBeenCalledWith({ title: "Sweep aisle 4" });
  });

  it("keeps the draft, locks the fields while adding and shows the error message when adding fails", async () => {
    const pending = deferred();
    const onAdd = vi.fn().mockReturnValueOnce(pending.promise.then(() => { throw new Error("The task list is read-only."); }))
      .mockRejectedValueOnce("offline");
    render(<TaskQuickAdd onAdd={onAdd} />);
    const title = screen.getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Count paint stock" } });
    await submit("Add task");
    expect(title.readOnly).toBe(true);
    expect(screen.getByRole("button", { name: "Add task" }).getAttribute("aria-busy")).toBe("true");
    await submit("Add task");
    expect(onAdd).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    expect(screen.getByRole("alert").textContent).toBe("The task list is read-only.");
    expect(title.value).toBe("Count paint stock");
    expect(title.readOnly).toBe(false);
    await submit("Add task");
    expect(screen.getByRole("alert").textContent).toBe("Couldn’t add task. Try again.");
    fireEvent.change(title, { target: { value: "Count paint stock today" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("TaskRecurrencePicker", () => {
  it("changes the frequency, keeps the end date while repeating and clears it when it stops repeating", () => {
    const onChange = vi.fn();
    const end = new Date(2026, 11, 31);
    const { rerender } = render(<TaskRecurrencePicker value={{ frequency: "none", endDate: null }} onChange={onChange} />);
    expect(optionLabels(select("Repeat task"))).toEqual(["Does not repeat", "Daily", "Weekly", "Monthly"]);
    expect(screen.queryByRole("button", { name: /^End date/ })).toBeNull();
    fireEvent.change(select("Repeat task"), { target: { value: "weekly" } });
    expect(onChange).toHaveBeenLastCalledWith({ frequency: "weekly", endDate: null });
    rerender(<TaskRecurrencePicker value={{ frequency: "weekly", endDate: end }} onChange={onChange} />);
    fireEvent.change(select("Repeat task"), { target: { value: "monthly" } });
    expect(onChange).toHaveBeenLastCalledWith({ frequency: "monthly", endDate: end });
    fireEvent.change(select("Repeat task"), { target: { value: "none" } });
    expect(onChange).toHaveBeenLastCalledWith({ frequency: "none", endDate: null });
  });

  it("picks an end date no earlier than the start date", async () => {
    const onChange = vi.fn();
    render(<TaskRecurrencePicker value={{ frequency: "daily", endDate: new Date(2026, 10, 19) }} startDate={new Date(2026, 10, 18)} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^End date/ }));
    const early = await screen.findByRole("button", { name: "Tuesday, November 17, 2026" });
    expect(early.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(early);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Monday, November 30, 2026" }));
    expect(onChange).toHaveBeenCalledWith({ frequency: "daily", endDate: new Date(2026, 10, 30) });
  });
});

describe("TaskSubtaskList", () => {
  const subtasks = [
    { id: "s1", title: "Tape the trim", complete: true },
    { id: "s2", title: "Cut in the corners", complete: false },
    { id: "s3", title: "Roll the walls", complete: false },
  ];

  it("reports progress in text and as a progress bar and toggles completion", () => {
    const onCompleteChange = vi.fn();
    render(<TaskSubtaskList subtasks={subtasks} onCompleteChange={onCompleteChange} pendingIds={["s3"]} />);
    expect(screen.getByRole("status").textContent).toBe("1 of 3 complete");
    const bar = screen.getByRole("progressbar", { name: "Subtask progress" }) as HTMLProgressElement;
    expect([bar.value, bar.max]).toEqual([1, 3]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Cut in the corners" }));
    expect(onCompleteChange).toHaveBeenCalledWith("s2", true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Tape the trim" }));
    expect(onCompleteChange).toHaveBeenLastCalledWith("s1", false);
    expect((screen.getByRole("checkbox", { name: "Roll the walls" }) as HTMLInputElement).disabled).toBe(true);
  });

  it("shows completion in words when it cannot be changed, with no add form", () => {
    render(<TaskSubtaskList subtasks={subtasks} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("Tape the trim · Complete")).toBeTruthy();
    expect(screen.getByText("Roll the walls · Open")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("adds a trimmed subtask, clears the name and keeps the submit button focusable", async () => {
    const onAdd = vi.fn();
    render(<TaskSubtaskList subtasks={subtasks} onAdd={onAdd} />);
    const name = screen.getByRole("textbox", { name: "Subtask name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "  Remove the tape " } });
    await submit("Add subtask");
    expect(onAdd).toHaveBeenCalledWith("Remove the tape");
    expect(name.value).toBe("");
    expect((screen.getByRole("button", { name: "Add subtask" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("asks for a name instead of adding a blank subtask and keeps the name when adding fails", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("Subtasks are limited to 20."));
    render(<TaskSubtaskList subtasks={[]} onAdd={onAdd} />);
    expect(screen.getByText("No subtasks.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("0 of 0 complete");
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Subtask name" }), { target: { value: "  " } });
    await submit("Add subtask");
    expect(screen.getByRole("alert").textContent).toBe("Enter a subtask name.");
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Subtask name" }), { target: { value: "Buy rollers" } });
    await submit("Add subtask");
    expect(screen.getByRole("alert").textContent).toBe("Subtasks are limited to 20.");
    expect((screen.getByRole("textbox", { name: "Subtask name" }) as HTMLInputElement).value).toBe("Buy rollers");
  });
});

describe("TaskTimeBlockEditor", () => {
  const zones = ["America/Chicago", "America/New_York"];

  it("saves the initial block and an edited one", async () => {
    const onSubmit = vi.fn();
    render(<TaskTimeBlockEditor timeZones={zones} initialValue={{ start: "2026-11-20T09:00", end: "2026-11-20T10:30", timeZone: "America/Chicago" }} onSubmit={onSubmit} />);
    await submit("Save time block");
    expect(onSubmit).toHaveBeenLastCalledWith({ start: "2026-11-20T09:00", end: "2026-11-20T10:30", timeZone: "America/Chicago" });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2026-11-20T11:00" } });
    fireEvent.change(select("Time zone"), { target: { value: "America/New_York" } });
    await submit("Save time block");
    expect(onSubmit).toHaveBeenLastCalledWith({ start: "2026-11-20T09:00", end: "2026-11-20T11:00", timeZone: "America/New_York" });
  });

  it("requires both times, an end after the start compared as times, and an available time zone", async () => {
    const onSubmit = vi.fn();
    render(<TaskTimeBlockEditor timeZones={zones} initialValue={{ start: "2026-11-20T09:00", end: "2026-11-20T09:00:00", timeZone: "Europe/Paris" }} onSubmit={onSubmit} />);
    expect(select("Time zone").value).toBe("");
    await submit("Save time block");
    expect(screen.getByRole("alert").textContent).toBe("Choose an end after the start.");
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "" } });
    await submit("Save time block");
    expect(screen.getByRole("alert").textContent).toBe("Choose a start and an end.");
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-11-20T08:00" } });
    await submit("Save time block");
    expect(screen.getByRole("alert").textContent).toBe("Choose an available time zone.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("That block overlaps the delivery window."));
    render(<TaskTimeBlockEditor timeZones={zones} initialValue={{ start: "2026-11-20T09:00", end: "2026-11-20T10:00", timeZone: "America/Chicago" }} onSubmit={onSubmit} />);
    await submit("Save time block");
    expect(screen.getByRole("alert").textContent).toBe("That block overlaps the delivery window.");
  });
});
