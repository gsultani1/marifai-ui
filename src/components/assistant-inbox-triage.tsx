// packages/ai-ui/src/components/assistant-inbox-triage.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export type AssistantTriageAction = "file" | "defer" | "follow-up";
export interface AssistantInboxItem { id: string; title: string; kind: string; detail?: string; allowed?: readonly AssistantTriageAction[] }

export interface AssistantInboxTriageProps {
  items: readonly AssistantInboxItem[];
  onOpen?: (id: string) => void;
  onTriage: (id: string, action: AssistantTriageAction) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function AssistantInboxTriage({ items, onOpen, onTriage, pendingIds = [], className }: AssistantInboxTriageProps) {
  const actions = [{id:"file",label:"File"},{id:"defer",label:"Defer"},{id:"follow-up",label:"Follow up"}] as const;
  return <ControlPanel slot="assistant-inbox-triage" title="Assistant inbox" className={className}>
    <FilteredList items={items} searchLabel="Search inbox" searchText={(item) => [item.title,item.kind,item.detail]}
      empty="No inbox items to review." noMatches="No matching inbox items." render={(item) => <ItemHeading title={item.title} detail={[item.kind,item.detail].filter(Boolean).join(" · ")}>
        <ControlAction label="Open" item={item.title} onClick={onOpen && (() => onOpen(item.id))} />
        {actions.filter(({id}) => !item.allowed || item.allowed.includes(id)).map(({id,label}) => <ControlAction key={id} label={label}
          item={item.title} disabled={pendingIds.includes(item.id)} onClick={() => onTriage(item.id,id)} />)}
      </ItemHeading>} />
  </ControlPanel>;
}
