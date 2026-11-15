// packages/ai-ui/src/components/automation-trigger-picker.tsx
"use client";

import { ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface AutomationTriggerOption { id: string; label: string; kind: "manual" | "scheduled" | "event"; description?: string }

export interface AutomationTriggerPickerProps {
  triggers: readonly AutomationTriggerOption[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

export function AutomationTriggerPicker({ triggers, value, onChange, className }: AutomationTriggerPickerProps) {
  const selected = triggers.find((item) => item.id === value);
  return <ControlPanel slot="automation-trigger-picker" title="Automation trigger" className={className}>
    <ChoiceField label="Trigger" value={selected?.id ?? ""} placeholder="Choose a trigger"
      options={triggers.map((item) => ({ value: item.id, label: item.label + " · " + item.kind }))}
      onChange={(id) => { if (id) onChange(id); }} />
    {selected?.description && <p className="text-sm break-words">{selected.description}</p>}
  </ControlPanel>;
}
