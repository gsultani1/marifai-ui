// packages/ai-ui/src/experimental/assistant-daily-briefing.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface BriefingItem { id: string; title: string; detail?: string }
export interface BriefingSections { agenda: readonly BriefingItem[]; priorities: readonly BriefingItem[]; followUps: readonly BriefingItem[] }

export interface AssistantDailyBriefingProps {
  briefing: BriefingSections;
  onOpen?: (section: keyof BriefingSections, id: string) => void;
  className?: string;
}

export function AssistantDailyBriefing({ briefing, onOpen, className }: AssistantDailyBriefingProps) {
  return <ControlPanel slot="assistant-daily-briefing" title="Daily briefing" className={className}>
    {(["agenda", "priorities", "followUps"] as const).map((section) => <div key={section} className="space-y-1">
      <h4 className="text-sm font-medium">{section === "agenda" ? "Agenda" : section === "priorities" ? "Priorities" : "Follow-ups"}</h4>
      <ItemList items={briefing[section]} empty="Nothing scheduled here." render={(item) => <ItemHeading title={item.title} detail={item.detail}>
        <ControlAction label="Open" item={item.title} onClick={onOpen && (() => onOpen(section, item.id))} />
      </ItemHeading>} />
    </div>)}
  </ControlPanel>;
}
