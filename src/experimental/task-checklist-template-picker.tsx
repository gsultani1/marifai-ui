// packages/ai-ui/src/experimental/task-checklist-template-picker.tsx
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
  const template = templates.find((item) => item.id === id);
  return <ControlPanel slot="task-checklist-template-picker" title="Checklist templates" className={className}>
    <AsyncForm label="Apply checklist template" submitLabel="Apply checklist" disabled={!template} onSubmit={() => { if (template) return onApply(template.id); }}>
      <ChoiceField label="Template" value={template?.id ?? ""} placeholder="Choose a template"
        options={templates.map((item) => ({value:item.id,label:item.title}))} onChange={setId} />
      {template && <ol className="list-decimal ps-5 text-sm">{template.steps.map((step,index) => <li key={index}>{step}</li>)}</ol>}
    </AsyncForm>
  </ControlPanel>;
}
