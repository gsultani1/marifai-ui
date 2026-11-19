// packages/ai-ui/src/experimental/assistant-availability-poll-review.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface AvailabilityPollSlot { id: string; label: string; responses: Readonly<Record<string,"yes" | "no" | "maybe">> }
export interface AvailabilityPollParticipant { id: string; label: string }

export interface AssistantAvailabilityPollReviewProps {
  slots: readonly AvailabilityPollSlot[];
  participants: readonly AvailabilityPollParticipant[];
  timeZone: string;
  onPropose: (id: string) => void | Promise<void>;
  className?: string;
}

export function AssistantAvailabilityPollReview({ slots, participants, timeZone, onPropose, className }: AssistantAvailabilityPollReviewProps) {
  const [id,setId] = useState("");
  const selected = slots.find((item) => item.id === id);
  return <ControlPanel slot="assistant-availability-poll-review" title="Availability poll" className={className}>
    <p className="text-sm text-muted-foreground">{timeZone}</p>
    {slots.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Participant availability</caption>
      <thead><tr><th scope="col">Participant</th>{slots.map((item) => <th scope="col" key={item.id} className="p-1">{item.label}</th>)}</tr></thead>
      <tbody>{participants.map((item) => <tr key={item.id} className="border-t border-border">
        <th scope="row">{item.label}</th>{slots.map((slot) => <td key={slot.id} className="p-1">{Object.hasOwn(slot.responses,item.id) ? slot.responses[item.id] : "No response"}</td>)}
      </tr>)}</tbody>
    </table></div>}
    <AsyncForm label="Propose a time" submitLabel="Propose time" disabled={!selected}
      onSubmit={() => { if (selected) return onPropose(selected.id); }}>
      <ChoiceField label="Proposed time" value={selected?.id ?? ""} options={slots.map((item) => ({value:item.id,label:item.label}))}
        placeholder="Choose a time" onChange={setId} />
    </AsyncForm>
  </ControlPanel>;
}
