// packages/ai-ui/src/components/form-wizard.tsx
"use client";

import { AlertCircleIcon, CheckIcon, LoaderCircleIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type StepState = "complete" | "current" | "upcoming" | "error";

export interface StepperStep {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Overrides the state derived from `current`, such as "error". */
  state?: StepState;
  optional?: boolean;
}

export interface StepperProps {
  steps: StepperStep[];
  current: number;
  /** Makes reachable steps clickable. */
  onStepClick?: (index: number) => void;
  /** Highest index the user may jump to; defaults to the current step. */
  reachable?: number;
  orientation?: "horizontal" | "vertical";
  label?: string;
  className?: string;
}

const STATE_TEXT: Record<StepState, string> = { complete: "completed", current: "current step", upcoming: "not started", error: "needs attention" };

/** Numbered steps with checks for finished ones, an error mark, and aria-current on the active step. */
export function Stepper({ steps, current, onStepClick, reachable = current, orientation = "horizontal", label = "Progress", className }: StepperProps) {
  return (
    <ol aria-label={label} className={cn("flex", orientation === "horizontal" ? "items-start gap-2" : "flex-col gap-1", className)}>
      {steps.map((step, index) => {
        const state: StepState = step.state ?? (index < current ? "complete" : index === current ? "current" : "upcoming");
        const clickable = Boolean(onStepClick) && index !== current && index <= reachable;
        const marker = (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums [&_svg]:size-3.5",
              state === "complete" && "border-primary bg-primary text-primary-foreground",
              state === "current" && "border-primary text-foreground ring-2 ring-ring/30",
              state === "upcoming" && "border-border text-muted-foreground",
              state === "error" && "border-destructive bg-destructive/10 text-destructive",
            )}
          >
            {state === "complete" ? <CheckIcon /> : state === "error" ? <AlertCircleIcon /> : index + 1}
          </span>
        );
        const text = (
          <span className="flex min-w-0 flex-col text-left">
            <span className={cn("text-sm font-medium", state === "upcoming" ? "text-muted-foreground" : "text-foreground")}>
              {step.title}
              {step.optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
            </span>
            {step.description && <span className="text-xs text-muted-foreground">{step.description}</span>}
            <span className="sr-only">, {STATE_TEXT[state]}</span>
          </span>
        );
        const body = (
          <>
            {orientation === "vertical" ? (
              <span className="flex flex-col items-center gap-1 self-stretch">
                {marker}
                {index < steps.length - 1 && <span aria-hidden="true" className={cn("min-h-4 w-px flex-1", state === "complete" ? "bg-primary" : "bg-border")} />}
              </span>
            ) : (
              marker
            )}
            {text}
          </>
        );
        const layout = cn("flex min-w-0 gap-2 text-left", orientation === "horizontal" ? "items-center" : "items-start gap-3 pb-3");
        return (
          <li key={step.id} aria-current={state === "current" ? "step" : undefined} className={cn("flex min-w-0 flex-col gap-2", orientation === "horizontal" && "flex-1")}>
            {orientation === "horizontal" && <span aria-hidden="true" className={cn("h-1 rounded-full", state === "complete" || state === "current" ? "bg-primary" : state === "error" ? "bg-destructive" : "bg-border")} />}
            {clickable ? (
              <button type="button" onClick={() => onStepClick?.(index)} className={cn(layout, "rounded-md", focusRing)}>
                {body}
              </button>
            ) : (
              <div className={layout}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

type Errors = string[] | null | undefined;

export interface WizardStep {
  id: string;
  title: string;
  description?: ReactNode;
  content: ReactNode;
  /** Returns messages that block leaving the step forward; may be async. */
  validate?: () => Errors | Promise<Errors>;
  optional?: boolean;
}

export interface FormWizardProps {
  steps: WizardStep[];
  step?: number;
  defaultStep?: number;
  onStepChange?: (index: number) => void;
  onSubmit: () => void | Promise<void>;
  submitLabel?: string;
  label?: string;
  className?: string;
}

/**
 * Multi-step form: each step validates before moving on, earlier steps stay
 * mounted (so their inputs keep their values) and reachable from the stepper,
 * and Submit re-validates every step and returns to the first one with
 * problems. Focus moves to the step heading on every change, and a failed or
 * slow submit keeps the user informed.
 */
export function FormWizard({ steps, step, defaultStep = 0, onStepChange, onSubmit, submitLabel = "Submit", label = "Form steps", className }: FormWizardProps) {
  const [current, setCurrent] = useControllableState<number>({ value: step, defaultValue: defaultStep, onChange: onStepChange });
  const [reached, setReached] = useState(current);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const id = useId();
  const last = current === steps.length - 1;

  const go = (index: number) => {
    setCurrent(index);
    setReached((value) => Math.max(value, index));
    requestAnimationFrame(() => document.getElementById(`${id}-heading-${index}`)?.focus());
  };

  const check = async (index: number) => {
    const target = steps[index];
    const result = (await target?.validate?.()) ?? [];
    setErrors((value) => ({ ...value, [target!.id]: result }));
    return result.length === 0;
  };

  const next = async () => {
    setBusy(true);
    try {
      if (await check(current)) go(current + 1);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      for (let index = 0; index < steps.length; index++) {
        if (!(await check(index))) {
          go(index);
          return;
        }
      }
      await onSubmit();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const jump = async (index: number) => {
    if (index < current) return go(index);
    setBusy(true);
    try {
      if (await check(current)) go(index);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void (last ? submit() : next());
      }}
      className={cn("flex flex-col gap-5", className)}
    >
      <Stepper
        label={label}
        current={current}
        reachable={reached}
        onStepClick={(index) => void jump(index)}
        steps={steps.map((item, index) => ({ id: item.id, title: item.title, ...(item.optional ? { optional: true } : {}), ...(errors[item.id]?.length && index !== current ? { state: "error" as const } : {}) }))}
      />
      {steps.map((item, index) => {
        const stepErrors = errors[item.id] ?? [];
        return (
          <section key={item.id} hidden={index !== current} aria-labelledby={`${id}-heading-${index}`} className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Step {index + 1} of {steps.length}
              </span>
              <h3 id={`${id}-heading-${index}`} tabIndex={-1} className="text-base font-semibold outline-none">
                {item.title}
              </h3>
              {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
            </div>
            {stepErrors.length > 0 && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium">Fix {stepErrors.length === 1 ? "this" : `these ${stepErrors.length}`} before continuing:</p>
                <ul className="mt-1 list-disc pl-5">
                  {stepErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.content}
          </section>
        );
      })}
      {submitError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {submitError}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <button type="button" disabled={current === 0 || busy} onClick={() => go(current - 1)} className={cn(button, buttonVariants.outline, focusRing)}>
          Back
        </button>
        <button type="submit" disabled={busy} className={cn(button, buttonVariants.primary, focusRing)}>
          {busy && <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          {last ? submitLabel : "Next"}
        </button>
      </div>
    </form>
  );
}
