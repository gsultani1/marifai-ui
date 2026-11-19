// packages/ai-ui/src/experimental/task-recurrence-picker.tsx
"use client";

import { ChoiceField, ControlPanel } from "../lib/component-controls.js";
import { DatePicker } from "../components/date-picker.js";
export interface TaskRecurrenceValue { frequency: "none" | "daily" | "weekly" | "monthly"; endDate: Date | null }

export interface TaskRecurrencePickerProps {
  value: TaskRecurrenceValue;
  onChange: (value: TaskRecurrenceValue) => void;
  startDate?: Date;
  className?: string;
}

export function TaskRecurrencePicker({ value, onChange, startDate, className }: TaskRecurrencePickerProps) {
  return <ControlPanel slot="task-recurrence-picker" title="Task recurrence" className={className}>
    <ChoiceField label="Repeat task" value={value.frequency}
      options={[{ value: "none", label: "Does not repeat" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]}
      onChange={(frequency) => { if (frequency) onChange({ frequency, endDate: frequency === "none" ? null : value.endDate }); }} />
    {value.frequency !== "none" && <DatePicker label="End date" value={value.endDate}
      {...(startDate ? { min: startDate } : {})} onValueChange={(endDate) => onChange({ ...value, endDate })} />}
  </ControlPanel>;
}
