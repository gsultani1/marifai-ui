// packages/ai-ui/src/components/assistant-reminder-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";
import { DatePicker } from "./date-picker.js";
import { TimePicker, formatTime } from "./time-picker.js";
export interface AssistantReminderValue { title: string; date: Date; time: string; timeZone: string }

export interface AssistantReminderEditorProps {
  /** An existing reminder to edit; without it the editor creates reminders and clears itself after each save. */
  initialValue?: AssistantReminderValue;
  timeZone: string;
  /** Receives the trimmed title and the time as "HH:mm". */
  onSubmit: (value: AssistantReminderValue) => void | Promise<void>;
  className?: string;
}

export function AssistantReminderEditor({ initialValue, timeZone, onSubmit, className }: AssistantReminderEditorProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [date, setDate] = useState<Date | null>(initialValue?.date ?? null);
  const [time, setTime] = useState<string | null>(initialValue?.time ?? null);
  const [saved, setSaved] = useState(false);
  return <ControlPanel slot="assistant-reminder-editor" title="Set reminder" className={className}>
    <AsyncForm label="Set reminder" submitLabel="Save reminder" onSubmit={async () => {
      setSaved(false);
      const canonical = time ? formatTime(time) : "";
      if (!title.trim() || !date || !Number.isFinite(date.getTime()) || !canonical) throw new Error("Enter a title, date and time.");
      await onSubmit({ title: title.trim(), date, time: canonical, timeZone });
      if (!initialValue) {
        setTitle("");
        setDate(null);
        setTime(null);
      }
      setSaved(true);
    }}>
      <Field label="Reminder title"><input className={fieldClass} value={title} onChange={(event) => { setSaved(false); setTitle(event.currentTarget.value); }} /></Field>
      <DatePicker label="Reminder date" value={date} onValueChange={(value) => { setSaved(false); setDate(value); }} />
      <TimePicker label="Reminder time" value={time} onValueChange={(value) => { setSaved(false); setTime(value); }} />
      <p className="text-sm">Time zone · {timeZone}</p>
    </AsyncForm>
    <p role="status" className={saved ? "text-sm text-muted-foreground" : "sr-only"}>{saved ? "Reminder saved." : ""}</p>
  </ControlPanel>;
}
