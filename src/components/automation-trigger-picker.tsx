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

const kindLabels = { manual: "Manual", scheduled: "Scheduled", event: "Event" } as const;

export function AutomationTriggerPicker({ triggers, value, onChange, className }: AutomationTriggerPickerProps) {
  const selected = triggers.find((item) => item.id === value);
  return <ControlPanel slot="automation-trigger-picker" title="Automation trigger" className={className}>
    <div>
      <ChoiceField label="Trigger" value={selected?.id ?? ""} placeholder="Choose a trigger"
        options={triggers.map((item) => ({ value: item.id, label: item.label + " · " + kindLabels[item.kind] }))}
        onChange={(id) => { if (id) onChange(id); }} />
      <div aria-live="polite">{selected?.description && <p className="mt-3 text-sm break-words">{selected.description}</p>}</div>
    </div>
  </ControlPanel>;
}
