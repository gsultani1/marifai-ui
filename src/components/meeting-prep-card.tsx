// packages/ai-ui/src/components/meeting-prep-card.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface MeetingPrepMaterial { id: string; title: string }
export interface MeetingPreparation { title: string; time: string; agenda: readonly string[]; attendees: readonly string[]; materials: readonly MeetingPrepMaterial[]; questions: readonly string[] }

export interface MeetingPrepCardProps {
  meeting: MeetingPreparation;
  onOpenMaterial?: (id: string) => void;
  className?: string;
}

export function MeetingPrepCard({ meeting, onOpenMaterial, className }: MeetingPrepCardProps) {
  return <ControlPanel slot="meeting-prep-card" title="Meeting preparation" className={className}>
    <ItemHeading title={meeting.title} detail={meeting.time} />
    {([{label:"Agenda",items:meeting.agenda},{label:"Attendees",items:meeting.attendees},{label:"Open questions",items:meeting.questions}]).map(({label,items}) => items.length > 0 &&
      <details key={label} open={label === "Agenda"}><summary className="cursor-pointer text-sm font-medium">{label} · {items.length}</summary>
        <ul className="list-disc ps-5 text-sm">{items.map((item,index) => <li key={index} className="break-words">{item}</li>)}</ul>
      </details>)}
    {meeting.materials.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Materials · {meeting.materials.length}</summary>
      <ItemList items={meeting.materials} empty="No materials." render={(item) => <ItemHeading title={item.title}>
        <ControlAction label="Open" item={item.title} onClick={onOpenMaterial && (() => onOpenMaterial(item.id))} />
      </ItemHeading>} />
    </details>}
  </ControlPanel>;
}
