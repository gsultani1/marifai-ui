// packages/ai-ui/src/components/task-quick-add.tsx
"use client";

import { PlusIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";

export interface QuickAddTask {
  title: string;
  /** An optional calendar date in YYYY-MM-DD format. */
  dueDate?: string;
}

export interface TaskQuickAddProps {
  /** Reject to keep the draft open for retry. */
  onAdd: (task: QuickAddTask) => void | Promise<void>;
  className?: string;
}

const fieldClass = cn("block h-8 w-full rounded-md border border-input bg-background px-2 text-sm", focusRing);

export function TaskQuickAdd({ onAdd, className }: TaskQuickAddProps) {
  const id = useId();
  const inFlight = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  function clearFeedback() {
    setAdded(false);
    setError("");
  }

  async function add() {
    const trimmed = title.trim();
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    clearFeedback();
    try {
      await onAdd(dueDate ? { title: trimmed, dueDate } : { title: trimmed });
      setTitle("");
      setDueDate("");
      setAdded(true);
      // The submit button disables once the title clears; keep focus ready for the next task.
      titleInput.current?.focus();
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn’t add task. Try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      aria-label="Add a task"
      data-slot="task-quick-add"
      className={cn("space-y-2 rounded-lg border border-border bg-card p-3 text-card-foreground", className)}
      onSubmit={(event) => { event.preventDefault(); void add(); }}
    >
      <label className="block space-y-1 text-xs font-medium" htmlFor={id}>
        <span>Task title</span>
        <input ref={titleInput} id={id} className={fieldClass} required value={title} readOnly={busy}
          onChange={(event) => { setTitle(event.currentTarget.value); clearFeedback(); }} />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 space-y-1 text-xs font-medium" htmlFor={id + "-due"}>
          <span>Due date (optional)</span>
          <input id={id + "-due"} type="date" className={fieldClass} value={dueDate} readOnly={busy}
            onChange={(event) => { setDueDate(event.currentTarget.value); clearFeedback(); }} />
        </label>
        <Button type="submit" size="sm" loading={busy} disabled={!title.trim()}><PlusIcon aria-hidden="true" /> Add task</Button>
      </div>
      <div role="status" className="text-xs text-muted-foreground">
        {added && "Task added."}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
