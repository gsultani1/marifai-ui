// packages/ai-ui/src/components/clarifying-questions.tsx
"use client";

import { XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

import { button, buttonVariants, card, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface ClarifyingOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
}

export interface ClarifyingQuestion {
  id: string;
  question: ReactNode;
  options?: ClarifyingOption[];
  /** Checkboxes instead of radio buttons. */
  multiple?: boolean;
  /** Offers a free-text answer. Always on when there are no options. */
  allowCustom?: boolean;
  /** Hides Skip for this question. */
  required?: boolean;
}

export interface ClarifyingAnswer {
  selected: string[];
  custom?: string;
}

/** Answers by question id; skipped questions map to null. */
export type ClarifyingAnswers = Record<string, ClarifyingAnswer | null>;

export interface ClarifyingQuestionsProps extends Omit<ComponentProps<"section">, "onSubmit" | "title"> {
  questions: ClarifyingQuestion[];
  onSubmit: (answers: ClarifyingAnswers) => void;
  onDismiss?: () => void;
  title?: ReactNode;
  submitLabel?: string;
}

const EMPTY: ClarifyingAnswer = { selected: [] };

const answered = (answer: ClarifyingAnswer | null | undefined) => Boolean(answer && (answer.selected.length > 0 || answer.custom?.trim()));

/**
 * One question at a time with segmented progress: radio or checkbox options,
 * an optional custom answer, and Skip, Back and Submit. A single-choice custom
 * answer replaces the selected option.
 */
export function ClarifyingQuestions({ questions, onSubmit, onDismiss, title = "A few questions before I start", submitLabel = "Submit answers", className, ...props }: ClarifyingQuestionsProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ClarifyingAnswers>({});
  const id = useId();
  const question = questions[Math.min(index, questions.length - 1)];
  if (!question) return null;
  const answer = answers[question.id] ?? EMPTY;
  const last = index >= questions.length - 1;
  const custom = question.allowCustom || !question.options?.length;
  const canAdvance = answered(answer);

  const update = (next: ClarifyingAnswer) => setAnswers((current) => ({ ...current, [question.id]: next }));

  const toggle = (value: string, checked: boolean) => {
    if (question.multiple) {
      update({ ...answer, selected: checked ? [...answer.selected, value] : answer.selected.filter((item) => item !== value) });
    } else {
      update({ selected: [value] });
    }
  };

  const advance = (skip: boolean) => {
    const next = skip ? { ...answers, [question.id]: null } : { ...answers, [question.id]: answered(answer) ? { selected: answer.selected, ...(answer.custom?.trim() ? { custom: answer.custom.trim() } : {}) } : null };
    setAnswers(next);
    if (last) onSubmit(Object.fromEntries(questions.map((item) => [item.id, next[item.id] ?? null])));
    else setIndex(index + 1);
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="clarifying-questions" className={cn(card, "flex flex-col gap-3 p-3 text-sm", className)} {...props}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 id={`${id}-title`} className="font-medium">
            {title}
          </h3>
          <div role="group" aria-label={`Question ${index + 1} of ${questions.length}`} className="flex gap-1">
            {questions.map((item, position) => (
              <span
                key={item.id}
                aria-hidden="true"
                className={cn("h-1 flex-1 rounded-full", position < index ? "bg-primary" : position === index ? "bg-primary/60" : "bg-muted")}
              />
            ))}
          </div>
        </div>
        {onDismiss && (
          <button type="button" aria-label="Dismiss questions" onClick={onDismiss} className={cn(iconButton, "size-7", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </div>
      <fieldset key={question.id} className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">
          <span className="sr-only">
            Question {index + 1} of {questions.length}:{" "}
          </span>
          {question.question}
        </legend>
        {question.options?.map((option) => {
          const checked = answer.selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn("flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 hover:bg-accent/50", checked ? "border-ring bg-accent/40" : "border-border")}
            >
              <input
                type={question.multiple ? "checkbox" : "radio"}
                name={`${id}-${question.id}`}
                value={option.value}
                checked={checked}
                onChange={(event) => toggle(option.value, event.target.checked)}
                className={cn("mt-0.5 size-4 accent-primary", focusRing)}
              />
              <span className="flex flex-col">
                <span>{option.label}</span>
                {option.description && <span className="text-xs text-muted-foreground">{option.description}</span>}
              </span>
            </label>
          );
        })}
        {custom && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{question.options?.length ? "Or write your own answer" : "Your answer"}</span>
            <textarea
              rows={2}
              value={answer.custom ?? ""}
              onChange={(event) => update({ selected: question.multiple ? answer.selected : event.target.value.trim() ? [] : answer.selected, custom: event.target.value })}
              className={cn("rounded-md border border-input bg-background px-2 py-1", focusRing)}
            />
          </label>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        {index > 0 && (
          <button type="button" onClick={() => setIndex(index - 1)} className={cn(button, buttonVariants.ghost, focusRing)}>
            Back
          </button>
        )}
        <span className="ml-auto flex gap-2">
          {!question.required && (
            <button type="button" onClick={() => advance(true)} className={cn(button, buttonVariants.outline, focusRing)}>
              Skip
            </button>
          )}
          <button type="button" aria-disabled={!canAdvance || undefined} onClick={() => canAdvance && advance(false)} className={cn(button, buttonVariants.primary, focusRing)}>
            {last ? submitLabel : "Next"}
          </button>
        </span>
      </div>
    </section>
  );
}
