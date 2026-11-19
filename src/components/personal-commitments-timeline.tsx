// packages/ai-ui/src/components/personal-commitments-timeline.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface PersonalCommitment { id: string; title: string; day: string; time?: string; source?: string }

export interface PersonalCommitmentsTimelineProps {
  /** Items arrive in chronological order with local display dates. */
  items: readonly PersonalCommitment[];
  onOpen?: (id: string) => void;
  className?: string;
}

export function PersonalCommitmentsTimeline({ items, onOpen, className }: PersonalCommitmentsTimelineProps) {
  const days = new Map<string,PersonalCommitment[]>();
  for (const item of items) {
    const group = days.get(item.day) ?? [];
    group.push(item);
    days.set(item.day,group);
  }
  return <ControlPanel slot="personal-commitments-timeline" title="Commitments" className={className}>
    {days.size ? <ol className="space-y-3 border-s border-border ps-3">{[...days].map(([day,group]) => <li key={day}>
      <h4 className="text-sm font-medium">{day}</h4>
      <ItemList items={group} empty="No commitments." render={(item) => <ItemHeading title={item.title} detail={[item.time,item.source].filter(Boolean).join(" · ")}>
        <ControlAction label="Open source" item={item.title} onClick={onOpen && (() => onOpen(item.id))} />
      </ItemHeading>} />
    </li>)}</ol> : <p className="text-sm text-muted-foreground">No upcoming commitments.</p>}
  </ControlPanel>;
}
