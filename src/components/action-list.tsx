// packages/ai-ui/src/components/action-list.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDownIcon, FileCodeIcon, PlayIcon, TerminalIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { collapsibleChevron, collapsiblePanel, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { aggregateStatus, type StepStatus, StepStatusIcon } from "../lib/step-status.js";
import type { WithClassName } from "../lib/types.js";

export type ActionStepStatus = Extract<StepStatus, "pending" | "running" | "complete" | "skipped" | "failed" | "aborted">;

export type ActionStep =
  | { id: string; kind: "file"; path: string; status: ActionStepStatus; label?: ReactNode; output?: string }
  | { id: string; kind: "command"; command: string; status: ActionStepStatus; label?: ReactNode; output?: string }
  | { id: string; kind: "start"; command?: string; status: ActionStepStatus; label?: ReactNode; output?: string }
  | { id: string; kind: "custom"; label: ReactNode; status: ActionStepStatus; icon?: ReactNode; output?: string };

export interface ActionListProps
  extends WithClassName<Omit<Collapsible.Root.Props, "open" | "defaultOpen" | "onOpenChange" | "title">> {
  title: ReactNode;
  steps: ActionStep[];
  /** False while the model is still adding steps; the list is "complete" only once closed. */
  closed?: boolean;
  /** Called with a file path when a "Write file" step is clicked. */
  onOpenFile?: (path: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function stepLabel(step: ActionStep): ReactNode {
  if (step.label) return step.label;
  if (step.kind === "file") return "Write";
  if (step.kind === "command") return "Run command";
  if (step.kind === "start") return "Start application";
  return null;
}

function stepIcon(step: ActionStep): ReactNode {
  if (step.kind === "file") return <FileCodeIcon aria-hidden="true" />;
  if (step.kind === "command") return <TerminalIcon aria-hidden="true" />;
  if (step.kind === "start") return <PlayIcon aria-hidden="true" />;
  return step.icon ?? null;
}

/**
 * Card listing what an agent is doing to the workspace: file writes,
 * commands and app starts, each with its own status. Opens itself when the
 * first step arrives unless the user has toggled it.
 */
export function ActionList({
  title,
  steps,
  closed = true,
  onOpenFile,
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  ...props
}: ActionListProps) {
  const [openState, setOpenState] = useState(defaultOpen ?? false);
  const userToggled = useRef(defaultOpen !== undefined);
  const open = openProp ?? openState;
  const status = aggregateStatus(
    steps.map((step) => step.status),
    closed,
  );
  const hasSteps = steps.length > 0;

  useEffect(() => {
    if (!hasSteps || userToggled.current || openProp !== undefined) return;
    userToggled.current = true;
    const frame = requestAnimationFrame(() => setOpenState(true));
    return () => cancelAnimationFrame(frame);
  }, [hasSteps, openProp]);

  const done = steps.filter((step) => step.status === "complete" || step.status === "skipped").length;

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(next) => {
        userToggled.current = true;
        setOpenState(next);
        onOpenChange?.(next);
      }}
      data-slot="action-list"
      data-status={status}
      className={cn("w-full rounded-lg border border-border bg-card text-sm text-card-foreground", className)}
      {...props}
    >
      <Collapsible.Trigger className={cn("group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent/50", focusRing)}>
        <StepStatusIcon status={status} />
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {hasSteps && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {done}/{steps.length}
          </span>
        )}
        <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />
      </Collapsible.Trigger>
      <Collapsible.Panel className={collapsiblePanel}>
        <ol className="flex flex-col gap-1 border-t border-border p-2">
          {steps.map((step) => (
            <li key={step.kind === "file" ? `file:${step.path}` : step.id} data-status={step.status} className="flex flex-col gap-1 rounded-md px-1.5 py-1">
              <div className="flex min-w-0 items-center gap-2">
                <StepStatusIcon status={step.status} />
                <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">{stepIcon(step)}</span>
                <span className="shrink-0">{stepLabel(step)}</span>
                {step.kind === "file" &&
                  (onOpenFile ? (
                    <button
                      type="button"
                      onClick={() => onOpenFile(step.path)}
                      className={cn("min-w-0 truncate rounded-sm font-mono text-xs underline-offset-2 hover:underline", focusRing)}
                    >
                      {step.path}
                    </button>
                  ) : (
                    <code className="min-w-0 truncate font-mono text-xs">{step.path}</code>
                  ))}
              </div>
              {(step.kind === "command" || step.kind === "start") && step.command && (
                <pre className="ml-6 overflow-x-auto rounded-md bg-code-background px-2 py-1 font-mono text-xs text-code-foreground">
                  <span aria-hidden="true" className="text-muted-foreground select-none">
                    ${" "}
                  </span>
                  {step.command}
                </pre>
              )}
              {step.output && (step.status === "failed" || step.status === "running") && (
                <pre className="ml-6 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs whitespace-pre-wrap">
                  {step.output}
                </pre>
              )}
            </li>
          ))}
        </ol>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
