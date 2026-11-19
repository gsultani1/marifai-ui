// packages/ai-ui/src/components/task-time-block-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";
import { wallClockTime } from "../lib/dates.js";

export interface TaskTimeBlock { start: string; end: string; timeZone: string }

export interface TaskTimeBlockEditorProps {
  initialValue?: TaskTimeBlock;
  timeZones: readonly string[];
  onSubmit: (block: TaskTimeBlock) => void | Promise<void>;
  className?: string;
}

export function TaskTimeBlockEditor({ initialValue, timeZones, onSubmit, className }: TaskTimeBlockEditorProps) {
  const [start,setStart] = useState(initialValue?.start ?? "");
  const [end,setEnd] = useState(initialValue?.end ?? "");
  const [zone,setZone] = useState(initialValue?.timeZone ?? "");
  return <ControlPanel slot="task-time-block-editor" title="Task time block" className={className}>
    <AsyncForm label="Task time block" submitLabel="Save time block" onSubmit={() => {
      if (!start || !end) throw new Error("Choose a start and an end.");
      // Compare as wall-clock times: values may differ in seconds, and the browser's time zone must not shift them.
      const from = wallClockTime(start);
      const to = wallClockTime(end);
      if (Number.isNaN(from) || Number.isNaN(to)) throw new Error("Enter a valid start and end.");
      if (to <= from) throw new Error("Choose an end after the start.");
      if (!timeZones.includes(zone)) throw new Error("Choose an available time zone.");
      return onSubmit({start,end,timeZone:zone});
    }}>
      <Field label="Starts"><input type="datetime-local" className={fieldClass} value={start} onChange={(event) => setStart(event.currentTarget.value)} /></Field>
      <Field label="Ends"><input type="datetime-local" className={fieldClass} value={end} onChange={(event) => setEnd(event.currentTarget.value)} /></Field>
      <ChoiceField label="Time zone" value={timeZones.includes(zone) ? zone : ""} placeholder="Choose a time zone"
        options={timeZones.map((value) => ({value,label:value}))} onChange={setZone} />
    </AsyncForm>
  </ControlPanel>;
}
