// packages/ai-ui/src/components/agent-mailbox.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlAction, ControlPanel, ItemHeading, ItemList, matchesQuery, SearchField } from "../lib/component-controls.js";

export interface AgentMailboxMessage { id: string; agentId: string; agent: string; subject: string; excerpt?: string; unread: boolean }

export interface AgentMailboxProps {
  messages: readonly AgentMailboxMessage[];
  onOpen: (id: string) => void;
  className?: string;
}

export function AgentMailbox({ messages, onOpen, className }: AgentMailboxProps) {
  const [agent, setAgent] = useState("");
  const [unread, setUnread] = useState(false);
  const [query, setQuery] = useState("");
  const agents = [...new Map(messages.map((message) => [message.agentId, message.agent]))].map(([value, label]) => ({ value, label }));
  const active = agents.some((item) => item.value === agent) ? agent : "";
  const visible = messages.filter((item) => (!active || active === item.agentId) && (!unread || item.unread)
    && matchesQuery(query, item.agent, item.subject, item.excerpt));
  return <ControlPanel slot="agent-mailbox" title="Agent mailbox" className={className}>
    <SearchField label="Search agent messages" value={query} onChange={setQuery} />
    <ChoiceField label="Agent" value={active} options={agents} placeholder="All agents" onChange={setAgent} />
    <label className="text-sm"><input type="checkbox" checked={unread} onChange={(event) => setUnread(event.currentTarget.checked)} /> Unread only</label>
    <ItemList items={visible} empty="No matching messages." render={(item) => <ItemHeading title={item.subject}
      detail={[item.agent, item.unread ? "Unread" : null, item.excerpt].filter(Boolean).join(" · ")}>
      <ControlAction label="Open" item={item.subject} onClick={() => onOpen(item.id)} />
    </ItemHeading>} />
  </ControlPanel>;
}
