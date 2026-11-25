// packages/ai-ui/src/components/task-checklist-template-picker.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface TaskChecklistTemplate { id: string; title: string; steps: readonly string[] }

export interface TaskChecklistTemplatePickerProps {
  templates: readonly TaskChecklistTemplate[];
  onApply: (id: string) => void | Promise<void>;
  className?: string;
}

export function TaskChecklistTemplatePicker({ templates, onApply, className }: TaskChecklistTemplatePickerProps) {
  const [id,setId] = useState("");
  const [applied, setApplied] = useState("");
  const template = templates.find((item) => item.id === id);
  return <ControlPanel slot="task-checklist-template-picker" title="Checklist templates" className={className}>
    {templates.length ? <AsyncForm label="Apply checklist template" submitLabel="Apply checklist"
      validate={() => template ? undefined : "Choose a template."}
      onSubmit={async () => {
        if (!template) return;
        await onApply(template.id);
        setId("");
        setApplied("Applied the " + template.title + " checklist.");
      }}>
      <ChoiceField label="Template" value={template?.id ?? ""} placeholder="Choose a template"
        options={templates.map((item) => ({value:item.id,label:item.title}))} onChange={(next) => { setId(next); setApplied(""); }} />
      {template && <ol aria-label={template.title + " steps"} className="list-decimal ps-5 text-sm">{template.steps.map((step,index) => <li key={index}>{step}</li>)}</ol>}
    </AsyncForm> : <p className="text-sm text-muted-foreground">No checklist templates.</p>}
    <p role="status" className="text-sm">{applied}</p>
  </ControlPanel>;
}
