// packages/ai-ui/src/components/automation-concurrency-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass, requiredNumber } from "../lib/component-controls.js";

export interface AutomationOverlapPolicy { id: string; label: string }
export interface AutomationConcurrencyValue { maxActiveRuns: number; overlapPolicyId: string }

export interface AutomationConcurrencyEditorProps {
  initialValue: AutomationConcurrencyValue;
  policies: readonly AutomationOverlapPolicy[];
  onSubmit: (value: AutomationConcurrencyValue) => void | Promise<void>;
  className?: string;
}

export function AutomationConcurrencyEditor({ initialValue, policies, onSubmit, className }: AutomationConcurrencyEditorProps) {
  const [limit,setLimit] = useState(String(initialValue.maxActiveRuns));
  const [policy,setPolicy] = useState(initialValue.overlapPolicyId);
  const available = policies.some((item) => item.id === policy);
  return <ControlPanel slot="automation-concurrency-editor" title="Automation concurrency" className={className}>
    <AsyncForm label="Automation concurrency" submitLabel="Save concurrency" onSubmit={() => {
      if (!available) throw new Error("Choose an overlap policy.");
      return onSubmit({maxActiveRuns:requiredNumber(limit,"Maximum active runs",1,true),overlapPolicyId:policy});
    }}>
      <Field label="Maximum active runs"><input inputMode="numeric" className={fieldClass} value={limit} onChange={(event) => setLimit(event.currentTarget.value)} /></Field>
      <ChoiceField label="Overlap policy" value={available ? policy : ""} placeholder="Choose a policy"
        options={policies.map((item) => ({value:item.id,label:item.label}))} onChange={setPolicy} />
    </AsyncForm>
  </ControlPanel>;
}
