// packages/ai-ui/src/components/agent-escalation-card.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface AgentEscalationDecision { id: string; label: string; effect: string; unavailableReason?: string }

export interface AgentEscalationCardProps {
  escalationId: string;
  title: string;
  description: string;
  decisions: readonly AgentEscalationDecision[];
  onDecide: (escalationId: string, decisionId: string) => void | Promise<void>;
  className?: string;
}

export function AgentEscalationCard({ escalationId, title, description, decisions, onDecide, className }: AgentEscalationCardProps) {
  const [choice,setChoice] = useState<{ escalationId: string; id: string }>();
  const selected = decisions.find((item) => choice?.escalationId === escalationId && item.id === choice.id);
  return <ControlPanel slot="agent-escalation-card" title="Agent escalation" className={className}>
    <ItemHeading title={title} detail={description} />
    <ItemList items={decisions} empty="No decisions available." render={(item) => <ItemHeading title={item.label}
      detail={[item.effect,item.unavailableReason].filter(Boolean).join(" · ")} />} />
    <AsyncForm key={escalationId} label="Agent escalation decision" submitLabel="Submit decision"
      disabled={!selected || Boolean(selected.unavailableReason)} onSubmit={async () => {
        if (!selected) return;
        const decided = { escalationId, id: selected.id };
        await onDecide(decided.escalationId, decided.id);
        // A newer escalation may have arrived and been answered while this one was pending; keep that choice.
        setChoice((current) => current?.escalationId === decided.escalationId && current.id === decided.id ? undefined : current);
      }}>
      <ChoiceField label="Decision" value={selected?.id ?? ""} placeholder="Choose a decision"
        options={decisions.map((item) => ({value:item.id,label:item.label,disabled:Boolean(item.unavailableReason)}))}
        onChange={(id) => setChoice({ escalationId,id })} />
    </AsyncForm>
  </ControlPanel>;
}
