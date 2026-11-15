// packages/ai-ui/src/components/assistant-follow-up-composer.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";
import { DatePicker } from "./date-picker.js";
export interface FollowUpPerson { id: string; name: string }
export interface AssistantFollowUpDraft { sourceId: string; title: string; personId: string | null; dueDate: Date | null }

export interface AssistantFollowUpComposerProps {
  sourceId: string;
  sourceLabel: string;
  people: readonly FollowUpPerson[];
  onSubmit: (draft: AssistantFollowUpDraft) => void | Promise<void>;
  className?: string;
}

export function AssistantFollowUpComposer({ sourceId, sourceLabel, people, onSubmit, className }: AssistantFollowUpComposerProps) {
  const [draft,setDraft] = useState<AssistantFollowUpDraft>(() => ({sourceId,title:"",personId:null,dueDate:null}));
  const value = draft.sourceId === sourceId ? draft : {sourceId,title:"",personId:null,dueDate:null};
  function edit(change: Partial<Omit<AssistantFollowUpDraft,"sourceId">>) { setDraft({...value,...change}); }
  return <ControlPanel slot="assistant-follow-up-composer" title="Add follow-up" className={className}>
    <p className="text-sm text-muted-foreground">Source · {sourceLabel}</p>
    <AsyncForm key={sourceId} label="Add follow-up" submitLabel="Save follow-up" disabled={!value.title.trim()} onSubmit={async () => {
      if (value.personId && !people.some((person) => person.id === value.personId)) throw new Error("Choose an available person.");
      await onSubmit({...value,title:value.title.trim()});
        setDraft((current) => current.sourceId === sourceId ? {sourceId,title:"",personId:null,dueDate:null} : current);
    }}>
      <Field label="Follow-up title"><input className={fieldClass} value={value.title} onChange={(event) => edit({title:event.currentTarget.value})} /></Field>
      <ChoiceField label="Person" value={value.personId ?? ""} placeholder="No person" options={people.map((item) => ({value:item.id,label:item.name}))}
        onChange={(personId) => edit({personId:personId || null})} />
      <DatePicker label="Follow-up due date" value={value.dueDate} onValueChange={(dueDate) => edit({dueDate})} />
    </AsyncForm>
  </ControlPanel>;
}
