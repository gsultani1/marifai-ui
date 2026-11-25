// packages/ai-ui/src/components/automation-action-builder.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlAction, ControlPanel } from "../lib/component-controls.js";
import { OrderedList } from "../lib/collection-controls.js";
export interface AutomationActionOption { id: string; label: string }
export interface AutomationActionStep { id: string; label: string; detail?: string }

export interface AutomationActionBuilderProps {
  steps: readonly AutomationActionStep[];
  actions: readonly AutomationActionOption[];
  onAdd: (actionId: string) => void;
  onRemove: (stepId: string) => void;
  onReorder: (stepIds: string[]) => void;
  className?: string;
}

export function AutomationActionBuilder({ steps, actions, onAdd, onRemove, onReorder, className }: AutomationActionBuilderProps) {
  const [actionId, setAction] = useState("");
  const available = actions.some((item) => item.id === actionId);
  return <ControlPanel slot="automation-action-builder" title="Automation actions" className={className}>
    <ChoiceField label="Action" value={available ? actionId : ""} placeholder="Choose an action"
      options={actions.map((item) => ({ value: item.id, label: item.label }))} onChange={setAction} />
    <ControlAction label="Add action" disabled={!available} onClick={() => {
      if (!available) return;
      onAdd(actionId);
      setAction("");
    }} />
    <p role="status" className="text-sm text-muted-foreground">
      {steps.length ? steps.length + (steps.length === 1 ? " action" : " actions") : "No actions added yet."}
    </p>
    {steps.length > 0 && <OrderedList items={steps} label="Action order" itemLabel={(item) => item.label} onReorder={onReorder}
      render={(item) => <span>{item.label}{item.detail && " · " + item.detail} <ControlAction label="Remove" item={item.label} onClick={() => onRemove(item.id)} /></span>} />}
  </ControlPanel>;
}
