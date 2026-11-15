// packages/ai-ui/src/components/model-parameters.tsx
"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useId } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatTokenCount, type ModelInfo } from "../lib/models.js";
import { NumberInput } from "./number-input.js";
import { SegmentedControl } from "./segmented-control.js";

export type ReasoningEffort = "low" | "medium" | "high";

export interface ModelParameterValues {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Tokens of conversation sent with each request. */
  contextTokens?: number;
  timeoutSeconds?: number;
  effort?: ReasoningEffort;
}

export type ModelParameterField = keyof ModelParameterValues;

const DEFAULT_MAX_OUTPUT = 32_000;
const LOW_BUDGET: Record<ReasoningEffort, number> = { low: 1024, medium: 4096, high: 8192 };

function clampValue(value: number | undefined, min: number, max: number): number | undefined {
  return value === undefined ? undefined : Math.min(max, Math.max(min, value));
}

/** Brings values into the model's limits, e.g. after switching to a model with a smaller output or context window. */
export function clampModelParameters(values: ModelParameterValues, model: Pick<ModelInfo, "maxOutput" | "contextWindow">): ModelParameterValues {
  const next: ModelParameterValues = { ...values };
  const maxTokens = clampValue(values.maxTokens, 1, model.maxOutput ?? DEFAULT_MAX_OUTPUT);
  const contextTokens = model.contextWindow ? clampValue(values.contextTokens, 1000, model.contextWindow) : values.contextTokens;
  const temperature = clampValue(values.temperature, 0, 2);
  const topP = clampValue(values.topP, 0, 1);
  if (maxTokens !== undefined) next.maxTokens = maxTokens;
  if (contextTokens !== undefined) next.contextTokens = contextTokens;
  if (temperature !== undefined) next.temperature = temperature;
  if (topP !== undefined) next.topP = topP;
  return next;
}

/** Output budget below which the chosen reasoning effort is likely to run out before answering. */
export function isLowOutputBudget(values: ModelParameterValues): boolean {
  return values.effort !== undefined && values.maxTokens !== undefined && values.maxTokens < LOW_BUDGET[values.effort];
}

export interface ModelParametersProps {
  model: ModelInfo;
  value: ModelParameterValues;
  onValueChange: (value: ModelParameterValues) => void;
  /** Restored by Reset. */
  defaults?: ModelParameterValues;
  /** Fields to offer; the model's capabilities still hide the ones it can't use. */
  fields?: ModelParameterField[];
  /** Temperature and top p are fixed by the model; true by default for reasoning models. */
  fixedSampling?: boolean;
  className?: string;
}

const ALL_FIELDS: ModelParameterField[] = ["effort", "maxTokens", "contextTokens", "temperature", "topP", "timeoutSeconds"];

/**
 * Generation settings that follow the model: reasoning effort only for
 * reasoning models, sampling locked where the model fixes it, token limits
 * capped at the model's output and context windows (values clamp when
 * committed), a warning with a one-click raise when the output budget is
 * too small for the effort, and Reset.
 */
export function ModelParameters({ model, value, onValueChange, defaults = {}, fields = ALL_FIELDS, fixedSampling, className }: ModelParametersProps) {
  const id = useId();
  const reasoning = model.capabilities?.includes("reasoning") ?? false;
  const samplingFixed = fixedSampling ?? reasoning;
  const maxOutput = model.maxOutput ?? DEFAULT_MAX_OUTPUT;
  const show = (field: ModelParameterField) => fields.includes(field) && (field !== "effort" || reasoning) && (field !== "contextTokens" || model.contextWindow !== undefined);
  const set = (patch: ModelParameterValues) => onValueChange({ ...value, ...patch });
  const changed = (Object.keys({ ...defaults, ...value }) as ModelParameterField[]).some((key) => value[key] !== defaults[key]);
  const raiseTo = Math.min(maxOutput, Math.max(LOW_BUDGET[value.effort ?? "medium"] * 2, 16_000));

  const numberField = (field: "maxTokens" | "contextTokens" | "temperature" | "topP" | "timeoutSeconds", label: string, options: { min: number; max: number; step: number; hint: string; disabled?: boolean }) => (
    <div className="flex flex-col gap-1">
      <span id={`${id}-${field}`} className="text-xs font-medium">
        {label}
      </span>
      <NumberInput
        aria-labelledby={`${id}-${field}`}
        aria-describedby={`${id}-${field}-hint`}
        value={value[field] ?? null}
        onValueChange={(next) => set({ [field]: next ?? undefined })}
        min={options.min}
        max={options.max}
        step={options.step}
        disabled={options.disabled ?? false}
        className="w-full"
      />
      <span id={`${id}-${field}-hint`} className="text-xs text-muted-foreground">
        {options.hint}
      </span>
    </div>
  );

  return (
    <fieldset data-slot="model-parameters" className={cn("flex flex-col gap-3 text-sm", className)}>
      <legend className="sr-only">Parameters for {model.name}</legend>
      {show("effort") && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">Reasoning effort</span>
          <SegmentedControl
            label="Reasoning effort"
            size="sm"
            value={value.effort ?? "medium"}
            onValueChange={(effort) => set({ effort })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            className="self-start"
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {show("maxTokens") && numberField("maxTokens", "Max output tokens", { min: 1, max: maxOutput, step: 256, hint: `Up to ${formatTokenCount(maxOutput)} for ${model.name}` })}
        {show("contextTokens") && numberField("contextTokens", "Context sent", { min: 1000, max: model.contextWindow ?? 1000, step: 1000, hint: `Window is ${formatTokenCount(model.contextWindow ?? 0)} tokens` })}
        {show("temperature") && numberField("temperature", "Temperature", { min: 0, max: 2, step: 0.1, hint: samplingFixed ? "Fixed by this model" : "Lower is more focused, higher more varied", disabled: samplingFixed })}
        {show("topP") && numberField("topP", "Top p", { min: 0, max: 1, step: 0.05, hint: samplingFixed ? "Fixed by this model" : "Probability mass sampled from", disabled: samplingFixed })}
        {show("timeoutSeconds") && numberField("timeoutSeconds", "Timeout (seconds)", { min: 5, max: 3600, step: 5, hint: "Stops a request that takes longer" })}
      </div>
      {show("effort") && isLowOutputBudget(value) && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs">
          <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
          <span className="flex-1">
            {formatTokenCount(value.maxTokens ?? 0)} output tokens is low for {value.effort} effort; the model may stop before it answers.
          </span>
          <button type="button" onClick={() => set({ maxTokens: raiseTo })} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
            Raise to {formatTokenCount(raiseTo)}
          </button>
        </div>
      )}
      <button type="button" disabled={!changed} onClick={() => onValueChange({ ...defaults })} className={cn(button, buttonVariants.ghost, "self-start", focusRing)}>
        <RotateCcwIcon aria-hidden="true" />
        Reset to defaults
      </button>
    </fieldset>
  );
}
