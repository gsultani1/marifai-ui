// packages/ai-ui/src/experimental/automation-retry-policy-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass, requiredNumber } from "../lib/component-controls.js";

export interface AutomationRetryPolicy { attempts: number; delaySeconds: number; mode: "fixed" | "exponential" }

export interface AutomationRetryPolicyEditorProps {
  initialValue: AutomationRetryPolicy;
  onSubmit: (policy: AutomationRetryPolicy) => void | Promise<void>;
  className?: string;
}

export function AutomationRetryPolicyEditor({ initialValue, onSubmit, className }: AutomationRetryPolicyEditorProps) {
  const [attempts, setAttempts] = useState(String(initialValue.attempts));
  const [delay, setDelay] = useState(String(initialValue.delaySeconds));
  const [mode, setMode] = useState(initialValue.mode);
  return <ControlPanel slot="automation-retry-policy-editor" title="Automation retry policy" className={className}>
    <AsyncForm label="Automation retry policy" submitLabel="Save retry policy" onSubmit={() => onSubmit({
      attempts: requiredNumber(attempts, "Maximum attempts", 1, true), delaySeconds: requiredNumber(delay, "Delay", 0, true), mode,
    })}>
      <Field label="Maximum attempts"><input className={fieldClass} inputMode="numeric" value={attempts} onChange={(event) => setAttempts(event.currentTarget.value)} /></Field>
      <ChoiceField label="Delay policy" value={mode} options={[{ value: "fixed", label: "Fixed" }, { value: "exponential", label: "Exponential" }]}
        onChange={(value) => { if (value) setMode(value); }} />
      <Field label="Delay in seconds"><input className={fieldClass} inputMode="numeric" value={delay} onChange={(event) => setDelay(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
