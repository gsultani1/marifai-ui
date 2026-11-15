// packages/ai-ui/src/components/progress-steps.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDownIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useMemo } from "react";

import { collapsibleChevron, collapsiblePanel, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type StepStatus, StepStatusIcon } from "../lib/step-status.js";

export interface ProgressNote {
  /** Notes with the same label replace each other, so repeated updates do not stack. */
  label: string;
  status: StepStatus;
  /** Sort key; notes without one keep arrival order. */
  order?: number;
  detail?: ReactNode;
}

export interface ProgressStepsProps extends Omit<ComponentProps<"div">, "children"> {
  notes: ProgressNote[];
  defaultOpen?: boolean;
}

export function dedupeProgress(notes: readonly ProgressNote[]): ProgressNote[] {
  const byLabel = new Map<string, { note: ProgressNote; index: number }>();
  notes.forEach((note, index) => {
    const existing = byLabel.get(note.label);
    byLabel.set(note.label, { note, index: existing?.index ?? index });
  });
  return [...byLabel.values()]
    .sort((a, b) => (a.note.order ?? a.index) - (b.note.order ?? b.index) || a.index - b.index)
    .map((entry) => entry.note);
}

/**
 * Server progress notes ("Reading 3 files", "Planning changes"), de-duplicated
 * by label. Collapsed it shows only the latest note; expanded it shows all.
 */
export function ProgressSteps({ notes, defaultOpen = false, className, ...props }: ProgressStepsProps) {
  const steps = useMemo(() => dedupeProgress(notes), [notes]);
  const latest = steps.at(-1);
  if (!latest) return null;

  return (
    <Collapsible.Root defaultOpen={defaultOpen} className={cn("text-sm", className)}>
      <div data-slot="progress-steps" {...props}>
        <Collapsible.Trigger className={cn("group flex w-full items-center gap-2 rounded-md py-1 text-left", focusRing)}>
          <StepStatusIcon status={latest.status} />
          <span role="status" className="min-w-0 flex-1 truncate">
            {latest.label}
          </span>
          {steps.length > 1 && <span className="text-xs text-muted-foreground tabular-nums">{steps.length} steps</span>}
          <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />
        </Collapsible.Trigger>
        <Collapsible.Panel className={collapsiblePanel}>
          <ol className="flex flex-col gap-1 py-1 pl-1">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-2">
                <StepStatusIcon status={step.status} />
                <div className="flex min-w-0 flex-col">
                  <span>{step.label}</span>
                  {step.detail && <span className="text-xs text-muted-foreground">{step.detail}</span>}
                </div>
              </li>
            ))}
          </ol>
        </Collapsible.Panel>
      </div>
    </Collapsible.Root>
  );
}
