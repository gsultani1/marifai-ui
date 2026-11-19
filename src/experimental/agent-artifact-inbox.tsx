// packages/ai-ui/src/experimental/agent-artifact-inbox.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface AgentInboxArtifact { id: string; title: string; agent: string; kind: string; available?: boolean }

export interface AgentArtifactInboxProps {
  artifacts: readonly AgentInboxArtifact[];
  onOpen: (id: string) => void;
  className?: string;
}

export function AgentArtifactInbox({ artifacts, onOpen, className }: AgentArtifactInboxProps) {
  return <ControlPanel slot="agent-artifact-inbox" title="Agent artifacts" className={className}>
    <FilteredList items={artifacts} searchLabel="Search artifacts" searchText={(item) => [item.title, item.agent, item.kind]}
      filterLabel="Kind" filters={[...new Set(artifacts.map((item) => item.kind))].map((value) => ({ value, label: value }))} category={(item) => item.kind}
      empty="No matching artifacts." render={(item) => <ItemHeading title={item.title} detail={item.agent + " · " + item.kind + (item.available === false ? " · Unavailable" : "")}>
        <ControlAction label="Open" item={item.title} disabled={item.available === false} onClick={() => onOpen(item.id)} />
      </ItemHeading>} />
  </ControlPanel>;
}
