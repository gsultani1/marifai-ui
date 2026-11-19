// packages/ai-ui/src/experimental/assistant-availability-picker.tsx
"use client";

import { ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface AssistantTimeSlot { id: string; label: string; unavailableReason?: string }

export interface AssistantAvailabilityPickerProps {
  slots: readonly AssistantTimeSlot[];
  timeZone: string;
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

export function AssistantAvailabilityPicker({ slots, timeZone, value, onChange, className }: AssistantAvailabilityPickerProps) {
  return <ControlPanel slot="assistant-availability-picker" title="Scheduling availability" className={className}>
    <p className="text-sm">Time zone · {timeZone}</p>
    {slots.length ? <ChoiceField label="Time slot" value={slots.some((item) => item.id === value) ? value ?? "" : ""} placeholder="Choose a time"
      options={slots.map((item) => ({ value: item.id, label: [item.label, item.unavailableReason].filter(Boolean).join(" · "), disabled: Boolean(item.unavailableReason) }))}
      onChange={(id) => { if (id) onChange(id); }} /> : <p className="text-sm text-muted-foreground">No time slots available.</p>}
  </ControlPanel>;
}
