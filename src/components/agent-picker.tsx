// packages/ai-ui/src/components/agent-picker.tsx
"use client";

import { Tabs } from "@base-ui/react/tabs";
import { BotIcon, LayoutTemplateIcon, PlusIcon, UsersIcon, XIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { button, buttonVariants, focusRing, iconButton, tabList, tabTrigger } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type AgentKind = "model" | "team" | "template";

export interface AgentOption {
  id: string;
  name: string;
  kind: AgentKind;
  description?: string;
  icon?: ReactNode;
}

export interface AgentParticipant {
  id: string;
  /** A "model" option's id. */
  agentId: string;
  role: string;
}

export interface AgentSelection {
  kind: AgentKind;
  id?: string;
}

export interface AgentPickerProps {
  agents: AgentOption[];
  value: AgentSelection;
  onValueChange: (value: AgentSelection) => void;
  /** Members of a custom team, edited on the Team tab. */
  participants?: AgentParticipant[];
  onParticipantsChange?: (participants: AgentParticipant[]) => void;
  roles?: string[];
  maxParticipants?: number;
  className?: string;
}

const KINDS: Record<AgentKind, { label: string; icon: ReactNode }> = {
  model: { label: "Model", icon: <BotIcon aria-hidden="true" /> },
  team: { label: "Team", icon: <UsersIcon aria-hidden="true" /> },
  template: { label: "Template", icon: <LayoutTemplateIcon aria-hidden="true" /> },
};

/**
 * Who answers: a single model, a saved team or a template, as tabs of
 * choices; the Team tab also builds a custom team of models, each with a
 * role, to add, change and remove.
 */
export function AgentPicker({ agents, value, onValueChange, participants = [], onParticipantsChange, roles = ["Lead", "Researcher", "Writer", "Reviewer"], maxParticipants = 6, className }: AgentPickerProps) {
  const id = useId();
  const models = agents.filter((agent) => agent.kind === "model");

  const choices = (kind: AgentKind) => {
    const options = agents.filter((agent) => agent.kind === kind);
    if (options.length === 0) return <p className="text-muted-foreground">Nothing to choose here yet.</p>;
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">{KINDS[kind].label}</legend>
        {options.map((agent) => (
          <label key={agent.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-ring has-[:checked]:bg-accent/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <input type="radio" name={`${id}-${kind}`} value={agent.id} checked={value.kind === kind && value.id === agent.id} onChange={() => onValueChange({ kind, id: agent.id })} className="mt-0.5 size-4 accent-primary" />
            <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{agent.icon ?? KINDS[kind].icon}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{agent.name}</span>
              {agent.description && <span className="text-xs text-muted-foreground">{agent.description}</span>}
            </span>
          </label>
        ))}
      </fieldset>
    );
  };

  const update = (participantId: string, patch: Partial<AgentParticipant>) => onParticipantsChange?.(participants.map((participant) => (participant.id === participantId ? { ...participant, ...patch } : participant)));

  return (
    <Tabs.Root value={value.kind} onValueChange={(kind: AgentKind) => onValueChange({ kind })} data-slot="agent-picker" className={cn("flex flex-col gap-3 text-sm", className)}>
      <Tabs.List aria-label="Answer with" className={tabList}>
        {(Object.keys(KINDS) as AgentKind[]).map((kind) => (
          <Tabs.Tab key={kind} value={kind} className={cn(tabTrigger, "inline-flex items-center gap-1.5 [&_svg]:size-3.5", focusRing)}>
            {KINDS[kind].icon}
            {KINDS[kind].label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel value="model" className="outline-none">
        {choices("model")}
      </Tabs.Panel>
      <Tabs.Panel value="team" className="flex flex-col gap-3 outline-none">
        {choices("team")}
        {onParticipantsChange && (
          <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium">Custom team</legend>
            {participants.length === 0 && <p className="text-xs text-muted-foreground">Add models and give each a role.</p>}
            <ol className="flex flex-col gap-2">
              {participants.map((participant, index) => (
                <li key={participant.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                  <select aria-label={`Member ${index + 1} model`} value={participant.agentId} onChange={(event) => update(participant.id, { agentId: event.target.value })} className={cn("h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs", focusRing)}>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <select aria-label={`Member ${index + 1} role`} value={participant.role} onChange={(event) => update(participant.id, { role: event.target.value })} className={cn("h-8 rounded-md border border-input bg-background px-2 text-xs", focusRing)}>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button type="button" aria-label={`Remove member ${index + 1}`} title="Remove" onClick={() => onParticipantsChange(participants.filter((item) => item.id !== participant.id))} className={cn(iconButton, "size-7", focusRing)}>
                    <XIcon aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              disabled={participants.length >= maxParticipants || models.length === 0}
              onClick={(event) => onParticipantsChange([...participants, { id: `member-${participants.length + 1}-${Math.round(event.timeStamp)}`, agentId: models[0]!.id, role: roles[Math.min(participants.length, roles.length - 1)] ?? "Member" }])}
              className={cn(button, buttonVariants.outline, "h-7 self-start px-2 text-xs", focusRing)}
            >
              <PlusIcon aria-hidden="true" />
              Add member
            </button>
            {participants.length >= maxParticipants && <p className="text-xs text-muted-foreground">Teams can have up to {maxParticipants} members.</p>}
          </fieldset>
        )}
      </Tabs.Panel>
      <Tabs.Panel value="template" className="outline-none">
        {choices("template")}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
