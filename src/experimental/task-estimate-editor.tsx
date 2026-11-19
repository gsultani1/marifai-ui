// packages/ai-ui/src/experimental/task-estimate-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass, requiredNumber } from "../lib/component-controls.js";


export interface TaskEstimateEditorProps {
  initialMinutes?: number;
  onSubmit: (minutes: number) => void | Promise<void>;
  className?: string;
}

export function TaskEstimateEditor({ initialMinutes, onSubmit, className }: TaskEstimateEditorProps) {
  const [amount, setAmount] = useState(initialMinutes?.toString() ?? "");
  const [unit, setUnit] = useState<"minutes" | "hours">("minutes");
  return <ControlPanel slot="task-estimate-editor" title="Task estimate" className={className}>
    <AsyncForm label="Task estimate" submitLabel="Save estimate" onSubmit={() => {
      const minutes = requiredNumber(amount, "Estimate", 0, unit === "minutes") * (unit === "hours" ? 60 : 1);
      if (!Number.isFinite(minutes)) throw new Error("Enter a smaller estimate.");
      return onSubmit(minutes);
    }}>
      <Field label="Duration"><input className={fieldClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} /></Field>
      <ChoiceField label="Unit" value={unit} options={[{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }]}
        onChange={(value) => { if (value) setUnit(value); }} />
    </AsyncForm>
  </ControlPanel>;
}
