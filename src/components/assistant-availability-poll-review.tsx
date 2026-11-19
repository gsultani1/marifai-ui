// packages/ai-ui/src/components/assistant-availability-poll-review.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel } from "../lib/component-controls.js";
import { Table } from "./table.js";

export interface AvailabilityPollSlot { id: string; label: string; responses: Readonly<Record<string,"yes" | "no" | "maybe">> }
export interface AvailabilityPollParticipant { id: string; label: string }

export interface AssistantAvailabilityPollReviewProps {
  slots: readonly AvailabilityPollSlot[];
  participants: readonly AvailabilityPollParticipant[];
  timeZone: string;
  onPropose: (id: string) => void | Promise<void>;
  className?: string;
}

const answers = { yes: "Yes", no: "No", maybe: "Maybe" } as const;

export function AssistantAvailabilityPollReview({ slots, participants, timeZone, onPropose, className }: AssistantAvailabilityPollReviewProps) {
  const [id,setId] = useState("");
  const selected = slots.find((item) => item.id === id);
  return <ControlPanel slot="assistant-availability-poll-review" title="Availability poll" className={className}>
    <p className="text-sm text-muted-foreground">Time zone · {timeZone}</p>
    {!slots.length ? <p className="text-sm text-muted-foreground">No time slots to review.</p> : <>
      {participants.length ? <Table label="Participant availability" className="text-left">
        <thead><tr><th scope="col" className="p-1">Participant</th>{slots.map((item) => <th scope="col" key={item.id} className="p-1">{item.label}</th>)}</tr></thead>
        <tbody>{participants.map((item) => <tr key={item.id} className="border-t border-border">
          <th scope="row" className="p-1">{item.label}</th>{slots.map((slot) => {
            const answer = Object.hasOwn(slot.responses,item.id) ? slot.responses[item.id] : undefined;
            return <td key={slot.id} className="p-1">{answer ? answers[answer] : "No response"}</td>;
          })}
        </tr>)}</tbody>
      </Table> : <p className="text-sm text-muted-foreground">No participants in this poll yet.</p>}
      <AsyncForm label="Propose a time" submitLabel="Propose time" disabled={!selected}
        onSubmit={() => { if (selected) return onPropose(selected.id); }}>
        <ChoiceField label="Proposed time" value={selected?.id ?? ""} options={slots.map((item) => ({value:item.id,label:item.label}))}
          placeholder="Choose a time" onChange={setId} />
      </AsyncForm>
    </>}
  </ControlPanel>;
}
