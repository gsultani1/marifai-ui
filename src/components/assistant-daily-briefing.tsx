// packages/ai-ui/src/components/assistant-daily-briefing.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface BriefingItem { id: string; title: string; detail?: string }
export interface BriefingSections { agenda: readonly BriefingItem[]; priorities: readonly BriefingItem[]; followUps: readonly BriefingItem[] }

export interface AssistantDailyBriefingProps {
  briefing: BriefingSections;
  onOpen?: (section: keyof BriefingSections, id: string) => void;
  className?: string;
}

const sections = [
  { key: "agenda", title: "Agenda", empty: "No agenda items today." },
  { key: "priorities", title: "Priorities", empty: "No priorities set." },
  { key: "followUps", title: "Follow-ups", empty: "No follow-ups due." },
] as const;

export function AssistantDailyBriefing({ briefing, onOpen, className }: AssistantDailyBriefingProps) {
  return <ControlPanel slot="assistant-daily-briefing" title="Daily briefing" className={className}>
    {sections.map(({ key: section, title, empty }) => <div key={section} className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <ItemList items={briefing[section]} empty={empty} render={(item) => <ItemHeading title={item.title} detail={item.detail}>
        <ControlAction label="Open" item={item.title} onClick={onOpen && (() => onOpen(section, item.id))} />
      </ItemHeading>} />
    </div>)}
  </ControlPanel>;
}
