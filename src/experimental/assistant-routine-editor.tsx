// packages/ai-ui/src/experimental/assistant-routine-editor.tsx
"use client";

import { useId, useRef, useState } from "react";
import { OrderedList } from "../lib/collection-controls.js";
import { AsyncForm, ChoiceField, ControlAction, ControlPanel, Field, fieldClass, ItemList } from "../lib/component-controls.js";
import { TimePicker, parseTime } from "../components/time-picker.js";

export interface AssistantRoutineStep { id: string; title: string }
export interface AssistantRoutineDraft {
  title: string;
  steps: readonly AssistantRoutineStep[];
  frequency: "manual" | "daily" | "weekly";
  time: string | null;
  timeZone: string;
  weekday?: number;
}
export interface AssistantRoutineEditorProps {
  initialValue: AssistantRoutineDraft;
  timeZones: readonly string[];
  onSubmit: (draft: AssistantRoutineDraft) => void | Promise<void>;
  className?: string;
}
const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export function AssistantRoutineEditor({ initialValue, timeZones, onSubmit, className }: AssistantRoutineEditorProps) {
  const [value,setValue] = useState(initialValue);
  const [step,setStep] = useState("");
  const prefix = useId();
  const counter = useRef(0);
  function update(update: Partial<AssistantRoutineDraft>) { setValue((current) => ({...current,...update})); }
  function addStep() {
    const title = step.trim();
    if (!title) return;
    let id: string;
    do { id = prefix + "-" + counter.current++; } while (value.steps.some((entry) => entry.id === id));
    update({steps:[...value.steps,{id,title}]});
    setStep("");
  }
  function submit() {
    if (!value.title.trim() || !value.steps.length || value.steps.some((item) => !item.title.trim())) throw new Error("Enter a routine name and at least one named step.");
    const scheduled = value.frequency !== "manual";
    if (scheduled && (!value.time || !parseTime(value.time) || !timeZones.includes(value.timeZone))) throw new Error("Choose a time and an available time zone.");
    if (value.frequency === "weekly" && (value.weekday === undefined || !weekdays[value.weekday])) throw new Error("Choose a weekday.");
    const { weekday, ...draft } = value;
    return onSubmit({...draft,title:value.title.trim(),steps:value.steps.map((item) => ({...item,title:item.title.trim()})),
      time:scheduled ? value.time : null, ...(value.frequency === "weekly" && weekday !== undefined ? {weekday} : {})});
  }
  return <ControlPanel slot="assistant-routine-editor" title="Edit routine" className={className}>
    <AsyncForm label="Edit routine" submitLabel="Save routine" onSubmit={submit}>
      <Field label="Routine name"><input className={fieldClass} value={value.title} onChange={(event) => update({title:event.currentTarget.value})} /></Field>
      <ItemList items={value.steps} empty="No routine steps." render={(item) => <div className="flex flex-wrap items-end gap-2">
        <Field label={"Step " + (value.steps.indexOf(item)+1)}><input className={fieldClass} value={item.title} onChange={(event) => {
          const title = event.currentTarget.value;
          update({steps:value.steps.map((entry) => entry.id === item.id ? {...entry,title} : entry)});
        }} /></Field>
        <ControlAction label="Remove step" item={item.title} onClick={() => update({steps:value.steps.filter((entry) => entry.id !== item.id)})} />
      </div>} />
      {value.steps.length > 1 && <OrderedList items={value.steps} label="Routine step order" itemLabel={(item) => item.title}
        onReorder={(ids) => update({steps:ids.flatMap((id) => value.steps.filter((item) => item.id === id))})} />}
      <Field label="New step"><input className={fieldClass} value={step} onChange={(event) => setStep(event.currentTarget.value)} /></Field>
      <ControlAction label="Add step" disabled={!step.trim()} onClick={addStep} />
      <ChoiceField label="Repeat" value={value.frequency} options={[{value:"manual",label:"Manual"},{value:"daily",label:"Daily"},{value:"weekly",label:"Weekly"}]}
        onChange={(frequency) => { if (frequency) update({frequency}); }} />
      {value.frequency !== "manual" && <>
        <TimePicker label="Routine time" value={value.time} onValueChange={(time) => update({time})} />
        <ChoiceField label="Time zone" value={timeZones.includes(value.timeZone) ? value.timeZone : ""} placeholder="Choose a time zone"
          options={timeZones.map((zone) => ({value:zone,label:zone}))} onChange={(timeZone) => update({timeZone})} />
      </>}
      {value.frequency === "weekly" && <ChoiceField label="Weekday" value={value.weekday?.toString() ?? ""} placeholder="Choose a weekday"
        options={weekdays.map((label,index) => ({value:String(index),label}))}
        onChange={(weekday) => { if (weekday) update({weekday:Number(weekday)}); }} />}
    </AsyncForm>
  </ControlPanel>;
}
