// packages/ai-ui/src/experimental/automation-run-input-form.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { ToolParameterForm, type ToolParameter, type ToolParameterValue } from "./tool-parameter-form.js";

export interface AutomationRunInputFormProps {
  automationId: string;
  automationName: string;
  parameters: readonly ToolParameter[];
  initialValues?: Readonly<Record<string,ToolParameterValue>>;
  onRun: (id: string, values: Record<string,ToolParameterValue>) => void | Promise<void>;
  className?: string;
}

export function AutomationRunInputForm({ automationId, automationName, parameters, initialValues, onRun, className }: AutomationRunInputFormProps) {
  return <ControlPanel slot="automation-run-input-form" title="Run automation" className={className}>
    <p className="text-sm break-words">{automationName}</p>
    <ToolParameterForm key={automationId} title="Run inputs" submitLabel="Request run" parameters={parameters}
      {...(initialValues ? {initialValues} : {})} onSubmit={(values) => onRun(automationId,values)} />
  </ControlPanel>;
}
