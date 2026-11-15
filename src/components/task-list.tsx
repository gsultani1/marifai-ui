// packages/ai-ui/src/components/task-list.tsx
"use client";

import { RotateCwIcon, SendIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type StepStatus, StepStatusIcon, stepStatusLabel } from "../lib/step-status.js";

export interface TaskQuestion {
  prompt: ReactNode;
  /** Offered as buttons; a free-text answer is always possible. */
  options?: string[];
  placeholder?: string;
}

export interface AgentTask {
  id: string;
  title: ReactNode;
  status: StepStatus;
  detail?: ReactNode;
  /** Shown as an inline answer form while the task needs input. */
  question?: TaskQuestion;
}

export interface TaskListProps extends Omit<ComponentProps<"ol">, "children"> {
  tasks: AgentTask[];
  onRetry?: (id: string) => void;
  onAnswer?: (id: string, answer: string) => void;
}

function AnswerForm({ task, onAnswer }: { task: AgentTask & { question: TaskQuestion }; onAnswer: (id: string, answer: string) => void }) {
  const [answer, setAnswer] = useState("");
  return (
    <form
      className="mt-1.5 flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/10 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (answer.trim()) onAnswer(task.id, answer.trim());
      }}
    >
      <p className="text-sm">{task.question.prompt}</p>
      {task.question.options && task.question.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.question.options.map((option) => (
            <button key={option} type="button" onClick={() => onAnswer(task.id, option)} className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}>
              {option}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          aria-label="Your answer"
          value={answer}
          placeholder={task.question.placeholder ?? "Type an answer"}
          onChange={(event) => setAnswer(event.target.value)}
          className={cn("h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm", focusRing)}
        />
        <button type="submit" disabled={!answer.trim()} className={cn(button, buttonVariants.primary, focusRing)}>
          <SendIcon aria-hidden="true" />
          Answer
        </button>
      </div>
    </form>
  );
}

/** Agent task list with per-task retry for failures and inline answers for open questions. */
export function TaskList({ tasks, onRetry, onAnswer, className, ...props }: TaskListProps) {
  return (
    <ol data-slot="task-list" className={cn("flex flex-col gap-1.5 text-sm", className)} {...props}>
      {tasks.map((task) => (
        <li key={task.id} data-status={task.status} className="flex items-start gap-2 rounded-md px-1 py-1">
          <span className="mt-0.5">
            <StepStatusIcon status={task.status} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0">{task.title}</span>
              {(task.status === "failed" || task.status === "blocked") && (
                <span className="text-xs text-muted-foreground">{stepStatusLabel(task.status)}</span>
              )}
              {task.status === "failed" && onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(task.id)}
                  className={cn("inline-flex items-center gap-1 rounded-sm text-xs font-medium hover:underline [&_svg]:size-3", focusRing)}
                >
                  <RotateCwIcon aria-hidden="true" />
                  Retry
                </button>
              )}
            </div>
            {task.detail && <span className="text-xs text-muted-foreground">{task.detail}</span>}
            {task.status === "needs-input" && task.question && onAnswer && (
              <AnswerForm task={task as AgentTask & { question: TaskQuestion }} onAnswer={onAnswer} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
