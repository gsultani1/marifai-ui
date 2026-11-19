// packages/ai-ui/src/components/delegation-request-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass, optionalNumber } from "../lib/component-controls.js";

export interface DelegationRecipient { id: string; label: string }
export interface DelegationRequest { recipientId: string; task: string; toolIds: string[]; budget?: number }

export interface DelegationRequestEditorProps {
  recipients: readonly DelegationRecipient[];
  tools: readonly DelegationRecipient[];
  initialValue?: Omit<DelegationRequest, "toolIds"> & { toolIds: readonly string[] };
  budgetLabel?: string;
  onSubmit: (request: DelegationRequest) => void | Promise<void>;
  className?: string;
}

export function DelegationRequestEditor({ recipients, tools, initialValue, budgetLabel = "Budget", onSubmit, className }: DelegationRequestEditorProps) {
  const [recipientId, setRecipient] = useState(initialValue?.recipientId ?? "");
  const [task, setTask] = useState(initialValue?.task ?? "");
  const [toolIds, setTools] = useState(initialValue?.toolIds ?? []);
  const [budget, setBudget] = useState(initialValue?.budget?.toString() ?? "");
  async function submit() {
    if (!recipients.some((item) => item.id === recipientId)) throw new Error("Choose a recipient.");
    if (!task.trim()) throw new Error("Enter a task.");
    const amount = optionalNumber(budget, budgetLabel, 0);
    const availableTools = toolIds.filter((id) => tools.some((item) => item.id === id));
    await onSubmit({ recipientId, task: task.trim(), toolIds: availableTools, ...(amount === undefined ? {} : { budget: amount }) });
    setRecipient(""); setTask(""); setTools([]); setBudget("");
  }
  return <ControlPanel slot="delegation-request-editor" title="Delegation request" className={className}>
    <AsyncForm label="Delegation request" submitLabel="Request delegation" onSubmit={submit}>
      <ChoiceField label="Recipient" value={recipientId} placeholder="Choose a recipient" options={recipients.map((item) => ({ value: item.id, label: item.label }))} onChange={setRecipient} />
      <Field label="Task"><textarea className={fieldClass} value={task} onChange={(event) => setTask(event.currentTarget.value)} /></Field>
      <fieldset className="space-y-1"><legend className="text-sm font-medium">Allowed tools</legend>
        {!tools.length && <p className="text-sm text-muted-foreground">No tools available.</p>}
        {tools.map((tool) => <label key={tool.id} className="block text-sm"><input type="checkbox" checked={toolIds.includes(tool.id)}
          onChange={(event) => setTools(event.currentTarget.checked ? [...toolIds, tool.id] : toolIds.filter((id) => id !== tool.id))} /> {tool.label}</label>)}
      </fieldset>
      <Field label={budgetLabel}><input className={fieldClass} inputMode="decimal" value={budget} onChange={(event) => setBudget(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
