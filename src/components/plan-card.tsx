// packages/ai-ui/src/components/plan-card.tsx
"use client";

import { LockIcon, PauseIcon, PlayIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import { badge, button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type StepStatus, StepStatusIcon } from "../lib/step-status.js";
import { MessageContent } from "./message-content.js";

export interface PlanStep {
  id: string;
  title: string;
  status: StepStatus;
  detail?: ReactNode;
}

export interface PlanSection {
  title: string;
  items: ReactNode[];
}

export interface PlanCardProps extends Omit<ComponentProps<"div">, "title"> {
  title: ReactNode;
  /** Markdown overview of the plan. */
  summary?: string;
  /** Package specifiers such as "react@19.3.1" or "@scope/pkg@2". */
  dependencies?: string[];
  /** Named colors shown as swatches. */
  colors?: Array<{ name: string; value: string }>;
  sections?: PlanSection[];
  steps?: PlanStep[];
  /** Makes steps that have not started editable: rename, remove and add. */
  onStepsChange?: (steps: PlanStep[]) => void;
  paused?: boolean;
  onPauseChange?: (paused: boolean) => void;
}

export function splitPackageSpecifier(specifier: string): { name: string; version?: string } {
  const at = specifier.lastIndexOf("@");
  if (at <= 0) return { name: specifier };
  return { name: specifier.slice(0, at), version: specifier.slice(at + 1) };
}

const LOCKED: StepStatus[] = ["complete", "running", "skipped", "failed", "aborted"];

let newStepCounter = 0;

/**
 * Structured plan from an agent: overview, dependencies, palette, free-form
 * sections and ordered steps. Started steps are locked; the rest can be
 * edited while the run is paused or before it starts.
 */
export function PlanCard({
  title,
  summary,
  dependencies,
  colors,
  sections,
  steps,
  onStepsChange,
  paused,
  onPauseChange,
  className,
  ...props
}: PlanCardProps) {
  const [draft, setDraft] = useState("");
  const editable = Boolean(onStepsChange);

  const update = (next: PlanStep[]) => onStepsChange?.(next);
  const addStep = () => {
    const text = draft.trim();
    if (!text || !steps) return;
    update([...steps, { id: `step-new-${++newStepCounter}`, title: text, status: "pending" }]);
    setDraft("");
  };

  return (
    <div data-slot="plan-card" className={cn(card, "flex flex-col gap-4 p-4 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold">{title}</h3>
        {onPauseChange && (
          <button type="button" onClick={() => onPauseChange(!paused)} className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}>
            {paused ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}
            {paused ? "Resume" : "Pause to edit"}
          </button>
        )}
      </div>
      {summary && <MessageContent className="text-sm">{summary}</MessageContent>}
      {dependencies && dependencies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Dependencies</h4>
          <ul className="flex flex-wrap gap-1.5">
            {dependencies.map((specifier) => {
              const { name, version } = splitPackageSpecifier(specifier);
              return (
                <li key={specifier} className={cn(badge, "font-mono")}>
                  {name}
                  {version && <span className="text-muted-foreground">@{version}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {colors && colors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Palette</h4>
          <ul className="flex flex-wrap gap-3">
            {colors.map((color) => (
              <li key={color.name} className="flex items-center gap-1.5 text-xs">
                <span role="img" aria-label={`${color.name}, ${color.value}`} className="size-5 rounded-md border border-border" style={{ background: color.value }} />
                <span>{color.name}</span>
                <code className="text-muted-foreground">{color.value}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sections?.map((section) => (
        <div key={section.title} className="flex flex-col gap-1.5">
          <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.title}</h4>
          <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground">
            {section.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {steps && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Steps</h4>
          <ol className="flex flex-col gap-1">
            {steps.map((step, index) => {
              const locked = LOCKED.includes(step.status) || (editable && paused === false);
              return (
                <li key={step.id} className="flex items-start gap-2">
                  <span className="mt-1.5 w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                  <span className="mt-1">
                    <StepStatusIcon status={step.status} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    {editable && !locked ? (
                      <input
                        aria-label={`Step ${index + 1}`}
                        value={step.title}
                        onChange={(event) => update(steps.map((entry) => (entry.id === step.id ? { ...entry, title: event.target.value } : entry)))}
                        className={cn("h-7 rounded-md border border-input bg-background px-2", focusRing)}
                      />
                    ) : (
                      <span className="py-1">
                        {step.title}
                        {editable && LOCKED.includes(step.status) && <LockIcon aria-label="Locked" className="ml-1.5 inline size-3 text-muted-foreground" />}
                      </span>
                    )}
                    {step.detail && <span className="text-xs text-muted-foreground">{step.detail}</span>}
                  </div>
                  {editable && !locked && (
                    <button
                      type="button"
                      aria-label={`Remove step ${index + 1}`}
                      onClick={() => update(steps.filter((entry) => entry.id !== step.id))}
                      className={cn(iconButton, "size-7", focusRing)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {editable && paused !== false && (
            <form
              className="flex gap-2 pl-7"
              onSubmit={(event) => {
                event.preventDefault();
                addStep();
              }}
            >
              <input
                aria-label="New step"
                placeholder="Add a step"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className={cn("h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2", focusRing)}
              />
              <button type="submit" disabled={!draft.trim()} className={cn(button, buttonVariants.outline, focusRing)}>
                <PlusIcon aria-hidden="true" />
                Add
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
