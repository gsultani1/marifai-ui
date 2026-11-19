// packages/ai-ui/src/experimental/agent-attention-queue.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface AgentAttentionItem { id: string; title: string; reason: "answer" | "approval" | "retry"; detail?: string }

export interface AgentAttentionQueueProps {
  items: readonly AgentAttentionItem[];
  onOpen: (id: string, reason: AgentAttentionItem["reason"]) => void;
  className?: string;
}

export function AgentAttentionQueue({ items, onOpen, className }: AgentAttentionQueueProps) {
  return <ControlPanel slot="agent-attention-queue" title="Runs needing attention" className={className}>
    <ItemList items={items} empty="No runs need attention." render={(item) => <ItemHeading title={item.title} detail={item.detail}>
      <ControlAction label={item.reason === "answer" ? "Answer" : item.reason === "approval" ? "Review approval" : "Review retry"}
        item={item.title} onClick={() => onOpen(item.id, item.reason)} />
    </ItemHeading>} />
  </ControlPanel>;
}
