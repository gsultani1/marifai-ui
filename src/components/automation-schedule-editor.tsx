// packages/ai-ui/src/components/automation-schedule-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";
import { DatePicker } from "./date-picker.js";
import { TimePicker, parseTime } from "./time-picker.js";

export type AutomationScheduleFrequency = "once" | "daily" | "weekly";
export interface AutomationSchedule {
  frequency: AutomationScheduleFrequency;
  date: Date | null;
  time: string | null;
  timeZone: string;
  weekdays: readonly number[];
}
export interface AutomationScheduleEditorProps {
  initialValue: AutomationSchedule;
  timeZones: readonly string[];
  nextRun?: string;
  onDraftChange?: (value: AutomationSchedule) => void;
  onSubmit: (value: AutomationSchedule) => void | Promise<void>;
  className?: string;
}
const frequencies = [{ value: "once", label: "Once" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }] as const;
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function AutomationScheduleEditor({ initialValue, timeZones, nextRun, onDraftChange, onSubmit, className }: AutomationScheduleEditorProps) {
  const [value, setValue] = useState(initialValue);
  function edit(change: Partial<AutomationSchedule>) {
    const next = { ...value, ...change };
    setValue(next);
    onDraftChange?.(next);
  }
  function submit() {
    if (!value.time || !parseTime(value.time)) throw new Error("Choose a valid run time.");
    if (value.frequency === "once" && (!value.date || !Number.isFinite(value.date.getTime()))) throw new Error("Choose a date for the one-time run.");
    if (!timeZones.includes(value.timeZone)) throw new Error("Choose an available time zone.");
    const selectedDays = weekdays.flatMap((_, day) => value.weekdays.includes(day) ? [day] : []);
    if (value.frequency === "weekly" && !selectedDays.length) throw new Error("Choose at least one weekday.");
    return onSubmit({ ...value, date: value.frequency === "once" ? value.date : null, weekdays: value.frequency === "weekly" ? selectedDays : [] });
  }
  return <ControlPanel slot="automation-schedule-editor" title="Automation schedule" className={className}>
    <AsyncForm label="Automation schedule" submitLabel="Save schedule" onSubmit={submit}>
      <ChoiceField label="Repeat" value={value.frequency} options={frequencies} onChange={(frequency) => { if (frequency) edit({ frequency }); }} />
      {value.frequency === "once" && <DatePicker label="Run date" value={value.date} onValueChange={(date) => edit({ date })} />}
      <TimePicker label="Run time" value={value.time} onValueChange={(time) => edit({ time })} />
      <Field label="Time zone"><select className={fieldClass} value={timeZones.includes(value.timeZone) ? value.timeZone : ""}
        onChange={(event) => edit({ timeZone: event.currentTarget.value })}>
        <option value="">Choose a time zone</option>
        {timeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
      </select></Field>
      {value.frequency === "weekly" && <fieldset className="flex flex-wrap gap-2">
        <legend className="text-sm">Days of week</legend>
        {weekdays.map((label, day) => <label key={label} className="text-sm"><input type="checkbox" checked={value.weekdays.includes(day)}
          onChange={(event) => edit({ weekdays: event.currentTarget.checked ? [...value.weekdays, day] : value.weekdays.filter((item) => item !== day) })} /> {label}</label>)}
      </fieldset>}
      <p role="status" className="text-sm">{nextRun && "Next run · " + nextRun}</p>
    </AsyncForm>
  </ControlPanel>;
}
