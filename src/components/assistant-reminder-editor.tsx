// packages/ai-ui/src/components/assistant-reminder-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";
import { DatePicker } from "./date-picker.js";
import { TimePicker, parseTime } from "./time-picker.js";
export interface AssistantReminderValue { title: string; date: Date; time: string; timeZone: string }

export interface AssistantReminderEditorProps {
  initialValue?: AssistantReminderValue;
  timeZone: string;
  onSubmit: (value: AssistantReminderValue) => void | Promise<void>;
  className?: string;
}

export function AssistantReminderEditor({ initialValue, timeZone, onSubmit, className }: AssistantReminderEditorProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [date, setDate] = useState<Date | null>(initialValue?.date ?? null);
  const [time, setTime] = useState<string | null>(initialValue?.time ?? null);
  return <ControlPanel slot="assistant-reminder-editor" title="Set reminder" className={className}>
    <AsyncForm label="Set reminder" submitLabel="Save reminder" onSubmit={() => {
      if (!title.trim() || !date || !Number.isFinite(date.getTime()) || !time || !parseTime(time)) throw new Error("Enter a title, date and time.");
      return onSubmit({ title: title.trim(), date, time, timeZone });
    }}>
      <Field label="Reminder title"><input className={fieldClass} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
      <DatePicker label="Reminder date" value={date} onValueChange={setDate} />
      <TimePicker label="Reminder time" value={time} onValueChange={setTime} />
      <p className="text-sm">Time zone · {timeZone}</p>
    </AsyncForm>
  </ControlPanel>;
}
