// packages/ai-ui/src/components/conversation-fork-tree.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { LabeledTree } from "../lib/collection-controls.js";
export interface ConversationFork { id: string; label: string; origin?: string; children?: readonly ConversationFork[] }

export interface ConversationForkTreeProps {
  branches: readonly ConversationFork[];
  activeId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function ConversationForkTree({ branches, activeId, onSelect, className }: ConversationForkTreeProps) {
  return <ControlPanel slot="conversation-fork-tree" title="Conversation forks" className={className}>
    {branches.length
      ? <LabeledTree items={branches} label="Forks" activeId={activeId} onSelect={onSelect} detail={(item) => item.origin} />
      : <p className="text-sm text-muted-foreground">No forks yet.</p>}
  </ControlPanel>;
}
